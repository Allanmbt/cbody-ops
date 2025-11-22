## 公共函数

### 1) 判断是否为管理员或超级管理员
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles ap
    WHERE ap.id = auth.uid()
      AND ap.is_active = true
      AND ap.role IN ('admin','superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles ap
    WHERE ap.id = auth.uid()
      AND ap.is_active = true
      AND ap.role = 'superadmin'
  );
$$;

-- 2) 基础 GRANT（表级权限 + 函数可执行）
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- user_profiles / user_connected_accounts 表权限
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_connected_accounts TO authenticated;

```
### 2) 判断当前用户是否是该技师

```sql
CREATE OR REPLACE FUNCTION public.is_current_user_girl(p_girl_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.girls g
    WHERE g.id = p_girl_id
      AND g.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_girl(UUID) TO authenticated;

```

## admin_profiles 策略

### 1. 超级管理员可以查看所有管理员
```sql

CREATE POLICY "admin.self.select"
  ON public.admin_profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "admin.self.update"
  ON public.admin_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 注意：这个策略允许任何已登录用户查看所有 admin_profiles
-- 因为 is_superadmin() 需要查询这个表
CREATE POLICY "admin.all.select"
  ON public.admin_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin.super.update"
  ON public.admin_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles ap
      WHERE ap.id = auth.uid()
        AND ap.is_active = true
        AND ap.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_profiles ap
      WHERE ap.id = auth.uid()
        AND ap.is_active = true
        AND ap.role = 'superadmin'
    )
  );

CREATE POLICY "admin.super.insert"
  ON public.admin_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_profiles ap
      WHERE ap.id = auth.uid()
        AND ap.is_active = true
        AND ap.role = 'superadmin'
    )
  );

```

## 操作日志访问策略
```sql
-- 管理员与超级管理员都可查看
CREATE POLICY "admin_can_view_operation_logs"
  ON public.admin_operation_logs
  FOR SELECT
  USING (public.is_admin());

-- 管理员与超级管理员都可写入
CREATE POLICY "admin_can_insert_operation_logs"
  ON public.admin_operation_logs
  FOR INSERT
  WITH CHECK (public.is_admin());


```
## cities城市表策略

### 读取权限（所有人可读）
```sql
CREATE POLICY "Cities are viewable by everyone" 
    ON cities FOR SELECT 
    USING (is_active = true);

```
### 管理员写入权限
```sql
CREATE POLICY "Cities are manageable by admins" 
    ON cities FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

```

## categories分类表策略

### 读取权限（所有人可读）
```sql
CREATE POLICY "Categories are viewable by everyone" 
    ON categories FOR SELECT 
    USING (is_active = true);

```
### 管理员写入权限
```sql
CREATE POLICY "Categories are manageable by admins" 
    ON categories FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');
    
```


## girls表策略

### 读取权限
```sql
CREATE POLICY "Girls are viewable by everyone" 
    ON girls FOR SELECT 
    USING (NOT is_blocked);

```

```sql
-- 技师本人可读取自己的 girls 记录（不受 is_blocked 限制）
CREATE POLICY "Girls can view their own profile"
  ON public.girls
  FOR SELECT
  USING (auth.uid() = user_id);
```
### 女孩自己可以更新
```sql
CREATE POLICY "Girls can update their own profile" 
    ON girls FOR UPDATE 
    USING (auth.uid() = user_id);

```
### 管理员全权限
```sql
CREATE POLICY "Girls are manageable by admins"
  ON public.girls
  FOR ALL
  USING (public.is_admin());

```

## girls_status表策略

### 读取权限
```sql
CREATE POLICY "Girls status are viewable by everyone" 
    ON girls_status FOR SELECT 
    USING (true);

```
### 女孩自己可以更新
```sql
CREATE POLICY "Girls can update their own status" 
    ON girls_status FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM girls g 
        WHERE g.id = girl_id AND g.user_id = auth.uid()
    ));

```

### 管理员全权限
```sql
CREATE POLICY "Girls status are manageable by admins"
  ON public.girls_status
  FOR ALL
  USING (public.is_admin());

```

## girl_work_sessions表策略

### 技师查看自己的工作会话记录
```sql
-- 技师只能查看自己的工作会话记录
CREATE POLICY "girl_work_sessions.self.select"
  ON public.girl_work_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = girl_id 
        AND g.user_id = auth.uid()
    )
  );

-- 管理员可以查看所有记录
CREATE POLICY "girl_work_sessions.admin.select"
  ON public.girl_work_sessions
  FOR SELECT
  USING (public.is_admin());

-- 说明：
-- ✅ SELECT: 技师查看自己的统计数据，管理员查看所有
-- ❌ INSERT: 仅通过触发器自动插入（girl_go_offline, order completed）
-- ❌ UPDATE: 历史记录不可修改
-- ❌ DELETE: 历史记录不可删除（如需清理，由管理员手动执行SQL）
```

## girls_media表策略

```sql
-- 所有人可查看已审核通过的媒体
CREATE POLICY "Girls media are viewable by everyone" 
  ON girls_media FOR SELECT 
  USING (status = 'approved');

-- 技师可查看自己的所有媒体
CREATE POLICY "Girls can view their own media" 
  ON girls_media FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM girls g 
    WHERE g.id = girl_id AND g.user_id = auth.uid()
  ));

  -- 技师可插入媒体
CREATE POLICY "Girls can insert their own media" 
  ON girls_media FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM girls g 
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  );

-- 技师可更新自己的媒体
CREATE POLICY "Girls can update their own media" 
  ON girls_media FOR UPDATE 
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM girls g 
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM girls g 
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  );

-- 技师可删除待审核的媒体
CREATE POLICY "Girls can delete their own media" 
  ON girls_media FOR DELETE 
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM girls g 
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  );

  -- tmp-uploads 桶策略
CREATE POLICY "技师可上传到自己目录"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tmp-uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "技师可读取自己目录"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tmp-uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "技师可删除自己目录"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tmp-uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

  -- 管理员全权限
  CREATE POLICY "Girls media are manageable by admins" 
  ON girls_media FOR ALL 
  USING (public.is_admin());

  -- 技师可以删除自己上传的媒体文件
CREATE POLICY "girls_media_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'girls-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许所有用户（包括匿名）读取已审核的媒体
CREATE POLICY "Allow public read approved media"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'girls-media'
  AND EXISTS (
    SELECT 1 FROM public.girls_media gm
    WHERE gm.storage_key = storage.objects.name
      AND gm.status = 'approved'
      AND gm.min_user_level <= COALESCE(
        (SELECT level FROM public.user_profiles WHERE id = auth.uid()),
        0
      )
  )
);

```


## girls_categories表策略

```sql
CREATE POLICY "Girls categories are viewable by everyone" 
    ON girls_categories FOR SELECT 
    USING (true);

CREATE POLICY "Girls categories are manageable by admins" 
    ON girls_categories FOR ALL 
    USING (public.is_admin());

```


## services表策略

### 服务项目（所有人可读活跃服务）
```sql
CREATE POLICY "Services are viewable by everyone" 
    ON services FOR SELECT 
    USING (is_active = true);

```
### 管理员全权限
```sql
CREATE POLICY "Services are manageable by admins" 
    ON services FOR ALL 
    using ((auth.jwt()->>'role') in ('admin','superadmin'))
with check ((auth.jwt()->>'role') in ('admin','superadmin'));

```

## service_durations表策略

### 服务时长（所有人可读活跃时长）
```sql
CREATE POLICY "Service durations are viewable by everyone" 
    ON service_durations FOR SELECT 
    USING (is_active = true);


```
### 管理员全权限
```sql
CREATE POLICY "Service durations are manageable by admins" 
    ON service_durations FOR ALL 
   using ((auth.jwt()->>'role') in ('admin','superadmin'))
with check ((auth.jwt()->>'role') in ('admin','superadmin'));

```

## admin_girl_services表策略

### 管理员技师服务绑定
```sql
CREATE POLICY "Admin girl services are viewable by everyone" 
    ON admin_girl_services FOR SELECT 
    USING (is_qualified = true);

```
### 管理员全权限
```sql
CREATE POLICY "Admin girl services are manageable by admins" 
    ON admin_girl_services FOR ALL 
    USING (public.is_admin());

```

## girl_service_durations表策略

### 技师服务时长配置
```sql
CREATE POLICY "Girl service durations are viewable by everyone" 
    ON girl_service_durations FOR SELECT 
    USING (is_active = true);

CREATE POLICY "Girls can manage their own service durations" 
    ON girl_service_durations FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM admin_girl_services ags 
        JOIN girls g ON g.id = ags.girl_id 
        WHERE ags.id = admin_girl_service_id AND g.user_id = auth.uid()
    ));

```
### 管理员全权限
```sql
CREATE POLICY "Girl service durations are manageable by admins" 
    ON girl_service_durations FOR ALL 
    USING (public.is_admin());

```

## user_profiles 表策略
```sql
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles.self.select"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "user_profiles.self.update"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles.self.insert"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 女孩可以查看其订单客户的 profile（只读 avatar_url 等基本信息）
CREATE POLICY "user_profiles.girl_customers.select"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.girls g ON g.id = o.girl_id
      WHERE o.user_id = user_profiles.id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "user_profiles.admin.select"
  ON public.user_profiles
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "user_profiles.admin.update"
  ON public.user_profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

```

## user_connected_accounts  表策略

```sql
-- 每人仅一个 is_primary（建议用部分唯一索引替代触发器）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_primary_account_per_user
  ON public.user_connected_accounts (user_id)
  WHERE is_primary = true;

CREATE POLICY "uconn.self.select"
  ON public.user_connected_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "uconn.self.mutate"
  ON public.user_connected_accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "uconn.admin.select"
  ON public.user_connected_accounts
  FOR SELECT
  USING (public.is_admin());

```

## user_addresses 表策略
```sql
-- 5. 用户可以查看自己的地址
CREATE POLICY "user_addresses.self.select"
  ON user_addresses
  FOR SELECT
  USING (user_id = auth.uid());

-- 6. 用户可以插入自己的地址
CREATE POLICY "user_addresses.self.insert"
  ON user_addresses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 7. 用户可以更新自己的地址
CREATE POLICY "user_addresses.self.update"
  ON user_addresses
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 8. 用户可以删除自己的地址
CREATE POLICY "user_addresses.self.delete"
  ON user_addresses
  FOR DELETE
  USING (user_id = auth.uid());

-- 9. 管理员可以查看所有地址
CREATE POLICY "user_addresses.admin.select"
  ON user_addresses
  FOR SELECT
  USING (public.is_admin());

-- 10. 管理员可以删除任何地址
CREATE POLICY "user_addresses.admin.delete"
  ON user_addresses
  FOR DELETE
  USING (public.is_admin());

```

## orders 策略

```sql
-- 当前登录者是否为该订单的客户
CREATE OR REPLACE FUNCTION public.is_current_user_customer(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_customer(uuid) TO authenticated;

-- 管理员所有权限
CREATE POLICY "orders.admin.all"
  ON public.orders
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 读取：用户只能看自己的订单
CREATE POLICY "orders.customer.select"
  ON public.orders
  FOR SELECT
  USING (public.is_current_user_customer(user_id));

-- 创建：用户只能创建 user_id=自己的订单
CREATE POLICY "orders.customer.insert"
  ON public.orders
  FOR INSERT
  WITH CHECK (public.is_current_user_customer(user_id));

-- 更新：用户只能更新自己的订单（如取消、补充联系电话等）
CREATE POLICY "orders.customer.update"
  ON public.orders
  FOR UPDATE
  USING (public.is_current_user_customer(user_id))
  WITH CHECK (public.is_current_user_customer(user_id));


-- 读取：技师只能看属于自己的订单
CREATE POLICY "orders.girl.select"
  ON public.orders
  FOR SELECT
  USING (public.is_current_user_girl(girl_id));

-- 更新：技师只能改属于自己的订单
CREATE POLICY "orders.girl.update"
  ON public.orders
  FOR UPDATE
  USING (public.is_current_user_girl(girl_id))
  WITH CHECK (public.is_current_user_girl(girl_id));


GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
```

## price_change_logs 表策略

```sql
-- 技师可以查看自己的改价记录
CREATE POLICY "price_change_logs.girls.select"
  ON price_change_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM girls g 
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  );

-- 管理员可以查看所有改价记录
CREATE POLICY "price_change_logs.admin.select"
  ON price_change_logs FOR SELECT
  USING (public.is_admin());

-- 管理员可以取消改价申请
CREATE POLICY "price_change_logs.admin.update"
  ON price_change_logs FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

## order_cancellations（订单取消记录表） 策略

```sql
-- 策略1：用户查看自己的取消记录
CREATE POLICY "order_cxl.user.select"
    ON public.order_cancellations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_cancellations.order_id
              AND o.user_id = auth.uid()
        )
    );

-- 策略2：用户取消自己的订单（仅 pending/confirmed）
CREATE POLICY "order_cxl.user.insert"
    ON public.order_cancellations
    FOR INSERT
    WITH CHECK (
        cancelled_by_role = 'user'
        AND cancelled_by_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_cancellations.order_id
              AND o.user_id = auth.uid()
              AND o.status IN ('pending', 'confirmed')
        )
    );

-- 策略3：技师查看自己订单的取消记录
CREATE POLICY "order_cxl.therapist.select"
    ON public.order_cancellations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_cancellations.order_id
              AND public.is_current_user_girl(o.girl_id)
        )
    );

-- 策略4：技师取消自己的订单
CREATE POLICY "order_cxl.therapist.insert"
    ON public.order_cancellations
    FOR INSERT
    WITH CHECK (
        cancelled_by_role = 'therapist'
        AND cancelled_by_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_cancellations.order_id
              AND public.is_current_user_girl(o.girl_id)
        )
    );

-- 策略5：管理员查看所有取消记录
CREATE POLICY "order_cxl.admin.select"
    ON public.order_cancellations
    FOR SELECT
    USING (public.is_admin());

-- 策略6：管理员可取消任何订单
CREATE POLICY "order_cxl.admin.insert"
    ON public.order_cancellations
    FOR INSERT
    WITH CHECK (
        public.is_admin()
        AND cancelled_by_role = 'admin'
    );

```

## order_reviews 策略

```sql
-- 策略1：用户只能评价自己的已完成订单
CREATE POLICY "order_reviews.customer.insert"
    ON public.order_reviews
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_reviews.order_id
              AND o.user_id = auth.uid()
              AND o.status = 'completed'
        )
    );

-- 策略2：用户可以查看自己的所有评价
CREATE POLICY "order_reviews.customer.select"
    ON public.order_reviews
    FOR SELECT
    USING (user_id = auth.uid());

-- 策略3：所有人可以查看已审核通过且满足等级要求的评价
CREATE POLICY "order_reviews.public.select"
    ON public.order_reviews
    FOR SELECT
    USING (
        status = 'approved'
        AND min_user_level <= COALESCE(
            (SELECT level FROM public.user_profiles WHERE id = auth.uid()),
            0
        )
    );

-- 策略4：技师可以查看自己收到的所有评价
CREATE POLICY "order_reviews.girl.select"
    ON public.order_reviews
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.girls g
            WHERE g.id = order_reviews.girl_id
              AND g.user_id = auth.uid()
        )
    );

-- 策略5：管理员可以查看所有评价
CREATE POLICY "order_reviews.admin.select"
    ON public.order_reviews
    FOR SELECT
    USING (public.is_admin());

-- 策略6：管理员可以更新评价（审核操作）
CREATE POLICY "order_reviews.admin.update"
    ON public.order_reviews
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 策略7：管理员可以删除评价
CREATE POLICY "order_reviews.admin.delete"
    ON public.order_reviews
    FOR DELETE
    USING (public.is_admin());

-- ========================================
-- 7. 授权
-- ========================================
GRANT SELECT, INSERT ON public.order_reviews TO authenticated;
GRANT UPDATE, DELETE ON public.order_reviews TO authenticated;
```

## travel_od_dual 表 RLS 策略

```sql
-- 策略1：所有人可读
CREATE POLICY "travel_od_dual.select_all"
  ON public.travel_od_dual
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 策略2：仅管理员/服务端可写
CREATE POLICY "travel_od_dual.admin_all"
  ON public.travel_od_dual
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
  
```

## chat_threads 表策略

```sql

-- 策略1：参与者可以查看自己的线程
CREATE POLICY "chat_threads.participants.select"
    ON public.chat_threads
    FOR SELECT
    USING (
        -- c2g: 客户或技师
        (thread_type = 'c2g' AND (
            customer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        -- s2c: 客服或客户
        (thread_type = 's2c' AND (
            support_id = auth.uid() OR
            customer_id = auth.uid()
        )) OR
        -- s2g: 客服或技师
        (thread_type = 's2g' AND (
            support_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        -- 管理员可以查看所有
        public.is_admin()
    );

-- 策略2：参与者可以更新线程（更新最后消息时间等）
CREATE POLICY "chat_threads.participants.update"
    ON public.chat_threads
    FOR UPDATE
    USING (
        (thread_type = 'c2g' AND (
            customer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        (thread_type = 's2c' AND (
            support_id = auth.uid() OR
            customer_id = auth.uid()
        )) OR
        (thread_type = 's2g' AND (
            support_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        public.is_admin()
    )
    WITH CHECK (
        (thread_type = 'c2g' AND (
            customer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        (thread_type = 's2c' AND (
            support_id = auth.uid() OR
            customer_id = auth.uid()
        )) OR
        (thread_type = 's2g' AND (
            support_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        public.is_admin()
    );

-- 策略3：参与者可以创建线程
CREATE POLICY "chat_threads.participants.insert"
    ON public.chat_threads
    FOR INSERT
    WITH CHECK (
        (thread_type = 'c2g' AND (
            customer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        (thread_type = 's2c' AND (
            support_id = auth.uid() OR
            customer_id = auth.uid()
        )) OR
        (thread_type = 's2g' AND (
            support_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = chat_threads.girl_id AND user_id = auth.uid())
        )) OR
        public.is_admin()
    );

-- 策略4：管理员可以更新（用于锁定/解锁）
CREATE POLICY "chat_threads.admin.all"
    ON public.chat_threads
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


```


## chat_messages 表策略

```sql
-- 策略1：参与者可以查看自己线程的消息
CREATE POLICY "chat_messages.participants.select"
    ON public.chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_threads ct
            WHERE ct.id = chat_messages.thread_id
            AND (
                (ct.thread_type = 'c2g' AND (
                    ct.customer_id = auth.uid() OR
                    EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid())
                )) OR
                (ct.thread_type = 's2c' AND (
                    ct.support_id = auth.uid() OR
                    ct.customer_id = auth.uid()
                )) OR
                (ct.thread_type = 's2g' AND (
                    ct.support_id = auth.uid() OR
                    EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid())
                ))
            )
        ) OR
        public.is_admin()
    );

-- 策略2：参与者可以发送消息（需判断锁定状态）
CREATE POLICY "chat_messages.participants.insert"
    ON public.chat_messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.chat_threads ct
            WHERE ct.id = chat_messages.thread_id
            AND (
                -- 验证是线程参与者
                (ct.thread_type = 'c2g' AND (
                    (ct.customer_id = auth.uid() AND sender_role = 'customer') OR
                    (EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid()) AND sender_role = 'girl')
                )) OR
                (ct.thread_type = 's2c' AND (
                    (ct.support_id = auth.uid() AND sender_role = 'support') OR
                    (ct.customer_id = auth.uid() AND sender_role = 'customer')
                )) OR
                (ct.thread_type = 's2g' AND (
                    (ct.support_id = auth.uid() AND sender_role = 'support') OR
                    (EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid()) AND sender_role = 'girl')
                ))
            )
            AND (
                -- 验证发言权限（仅c2g线程需要检查锁定状态）
                ct.thread_type != 'c2g' OR
                NOT ct.is_locked OR
                ct.temporary_unlock_until > NOW() OR
                sender_role = 'system'
            )
        )
    );

-- 策略3：管理员可以插入系统消息
CREATE POLICY "chat_messages.admin.insert"
    ON public.chat_messages
    FOR INSERT
    WITH CHECK (
        public.is_admin() 
        AND sender_role = 'system'
    );

-- 策略4：管理员可以查看所有消息
CREATE POLICY "chat_messages.admin.select"
    ON public.chat_messages
    FOR SELECT
    USING (public.is_admin());

```

## chat_receipts 表策略

```sql

-- Policy 1: Users can view read receipts for threads they participate in
CREATE POLICY "chat_receipts.participants.select"
    ON public.chat_receipts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_threads ct
            WHERE ct.id = chat_receipts.thread_id
            AND (
                -- Customer can see all receipts in their threads
                (ct.thread_type = 'c2g' AND ct.customer_id = auth.uid()) OR
                -- Girl can see all receipts in their threads
                (ct.thread_type = 'c2g' AND EXISTS (
                    SELECT 1 FROM public.girls g
                    WHERE g.id = ct.girl_id AND g.user_id = auth.uid()
                )) OR
                -- Support can see receipts in s2c/s2g threads
                (ct.thread_type IN ('s2c', 's2g') AND ct.support_id = auth.uid())
            )
        )
    );

-- Policy 2: Users can only insert/update their own read receipts
CREATE POLICY "chat_receipts.self.modify"
    ON public.chat_receipts
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy 3: Admins can view all read receipts
CREATE POLICY "chat_receipts.admin.select"
    ON public.chat_receipts
    FOR SELECT
    USING (public.is_admin());
-- ========================================
-- 6. 授权
-- ========================================
GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_receipts TO authenticated;
```

---

## user_blocks 表策略

```sql
-- ========================================
-- RLS 策略：user_blocks（用户屏蔽表）
-- ========================================

-- 启用 RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- 策略1：技师查看自己的屏蔽列表
CREATE POLICY "user_blocks.girl.select"
  ON public.user_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = girl_id
        AND g.user_id = auth.uid()
    )
  );

-- 策略2：技师可以屏蔽/解除屏蔽客户（INSERT/UPDATE）
CREATE POLICY "user_blocks.girl.upsert"
  ON public.user_blocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = girl_id
        AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = girl_id
        AND g.user_id = auth.uid()
    )
  );

-- 策略3：管理员查看所有屏蔽记录
CREATE POLICY "user_blocks.admin.select"
  ON public.user_blocks
  FOR SELECT
  USING (public.is_admin());

-- 策略4：管理员可管理所有屏蔽记录
CREATE POLICY "user_blocks.admin.all"
  ON public.user_blocks
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ========================================
-- 授权
-- ========================================
GRANT SELECT, INSERT, UPDATE ON public.user_blocks TO authenticated;
```

**说明**：
- 技师只能查看和管理自己的屏蔽列表
- 客户端无法访问此表（无对应策略）
- 管理员拥有完全访问权限
- 使用 `FOR ALL` 策略简化 INSERT/UPDATE/DELETE 权限管理

---

## Storage Policies for chat-images 存储桶策略

```sql
-- 策略1：线程参与者可以上传图片
CREATE POLICY "chat_images.participants.insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.chat_threads ct
    WHERE (storage.foldername(name))[1] = ct.id::text
    AND (
        (ct.thread_type = 'c2g' AND (
            ct.customer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid())
        )) OR
        (ct.thread_type = 's2c' AND (
            ct.support_id = auth.uid() OR
            ct.customer_id = auth.uid()
        )) OR
        (ct.thread_type = 's2g' AND (
            ct.support_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid())
        ))
    )
    AND (
        -- 只有未锁定或临时解锁的c2g线程才能上传
        ct.thread_type != 'c2g' OR
        NOT ct.is_locked OR
        ct.temporary_unlock_until > NOW()
    )
  )
);

-- 策略2：线程参与者可以读取图片
CREATE POLICY "chat_images.participants.select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM public.chat_threads ct
    WHERE (storage.foldername(name))[1] = ct.id::text
    AND (
        (ct.thread_type = 'c2g' AND (
            ct.customer_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid())
        )) OR
        (ct.thread_type = 's2c' AND (
            ct.support_id = auth.uid() OR
            ct.customer_id = auth.uid()
        )) OR
        (ct.thread_type = 's2g' AND (
            ct.support_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.girls WHERE id = ct.girl_id AND user_id = auth.uid())
        ))
    )
  )
);

-- 策略3：管理员可以读取所有聊天图片
CREATE POLICY "chat_images.admin.select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND public.is_admin()
);

-- 策略4：管理员可以删除聊天图片
CREATE POLICY "chat_images.admin.delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND public.is_admin()
);

```
## app_configs 系统配置表策略

```sql
ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfg.read.any"
    ON public.app_configs
    FOR SELECT
    USING (true);

CREATE POLICY "cfg.admin.write"
    ON public.app_configs
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

```

## app_devices 应用设备表策略(推送)

```sql
-- 启用 RLS
ALTER TABLE public.app_devices ENABLE ROW LEVEL SECURITY;

-- 策略1：客户端用户只能查看自己的设备
CREATE POLICY "app_devices.client.select"
    ON public.app_devices
    FOR SELECT
    USING (
        role = 'client' 
        AND user_id = auth.uid()
    );

-- 策略2：技师端用户只能查看自己的设备
CREATE POLICY "app_devices.girl.select"
    ON public.app_devices
    FOR SELECT
    USING (
        role = 'girl' 
        AND EXISTS (
            SELECT 1 FROM public.girls 
            WHERE id = app_devices.girl_id 
              AND user_id = auth.uid()
        )
    );

-- 策略3：客户端用户可以注册/更新自己的设备
CREATE POLICY "app_devices.client.upsert"
    ON public.app_devices
    FOR ALL
    USING (
        role = 'client' 
        AND user_id = auth.uid()
    )
    WITH CHECK (
        role = 'client' 
        AND user_id = auth.uid()
    );

-- 策略4：技师端用户可以注册/更新自己的设备
CREATE POLICY "app_devices.girl.upsert"
    ON public.app_devices
    FOR ALL
    USING (
        role = 'girl' 
        AND EXISTS (
            SELECT 1 FROM public.girls 
            WHERE id = app_devices.girl_id 
              AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        role = 'girl' 
        AND EXISTS (
            SELECT 1 FROM public.girls 
            WHERE id = app_devices.girl_id 
              AND user_id = auth.uid()
        )
    );

-- 策略5：管理员可以查看所有设备
CREATE POLICY "app_devices.admin.select"
    ON public.app_devices
    FOR SELECT
    USING (public.is_admin());

-- 策略6：管理员可以管理所有设备
CREATE POLICY "app_devices.admin.all"
    ON public.app_devices
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ========================================
-- 6. 授权
-- ========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_devices TO authenticated;

```

## girl_settlement_accounts 技师结算账户表策略

```sql
ALTER TABLE public.girl_settlement_accounts ENABLE ROW LEVEL SECURITY;

-- 技师查看自己的结算账户
CREATE POLICY "girl_settlement_accounts.self.select"
  ON public.girl_settlement_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  );

-- 管理员查看所有账户
CREATE POLICY "girl_settlement_accounts.admin.select"
  ON public.girl_settlement_accounts
  FOR SELECT
  USING (public.is_admin());

-- 管理员可以修改账户（调整余额、设置阈值等）
CREATE POLICY "girl_settlement_accounts.admin.all"
  ON public.girl_settlement_accounts
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.girl_settlement_accounts TO authenticated;
```

---

## order_settlements 订单结算明细表策略

```sql
ALTER TABLE public.order_settlements ENABLE ROW LEVEL SECURITY;

-- 技师查看自己的订单结算记录
CREATE POLICY "order_settlements.self.select"
  ON public.order_settlements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = girl_id AND g.user_id = auth.uid()
    )
  );

-- 管理员查看所有结算记录
CREATE POLICY "order_settlements.admin.select"
  ON public.order_settlements
  FOR SELECT
  USING (public.is_admin());

-- 管理员可以修改结算记录（记录顾客支付等）
CREATE POLICY "order_settlements.admin.all"
  ON public.order_settlements
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.order_settlements TO authenticated;
```

---

## settlement_transactions 结算交易记录表策略

**用途说明**：唯一记录"真实资金流动"的申请与确认。只记录技师给平台结账或平台向技师打款提现，不再关联具体订单。

```sql
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;

-- 技师查看自己的结账/提现记录
CREATE POLICY "settlement_transactions.self.select"
  ON public.settlement_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = settlement_transactions.girl_id 
        AND g.user_id = auth.uid()
    )
  );

-- 技师可以创建结账/提现申请（默认待审核）
CREATE POLICY "settlement_transactions.self.insert"
  ON public.settlement_transactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.id = settlement_transactions.girl_id 
        AND g.user_id = auth.uid()
    )
    AND transaction_type IN ('settlement', 'withdrawal')
    AND status = 'pending'
  );

-- 管理员查看所有记录
CREATE POLICY "settlement_transactions.admin.select"
  ON public.settlement_transactions
  FOR SELECT
  USING (public.is_admin());

-- 管理员可以管理所有记录（审核、取消等）
CREATE POLICY "settlement_transactions.admin.all"
  ON public.settlement_transactions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.settlement_transactions TO authenticated;
```

---

## reports（举报表）策略

```sql
-- 启用 RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 策略1：用户查看自己提交的举报
CREATE POLICY "reports.reporter.select"
  ON public.reports
  FOR SELECT
  USING (reporter_id = auth.uid());

-- 策略2：技师可以提交举报（仅 reporter_role = 'girl'）
CREATE POLICY "reports.girl.insert"
  ON public.reports
  FOR INSERT
  WITH CHECK (
    reporter_role = 'girl'
    AND reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.girls g
      WHERE g.user_id = auth.uid()
    )
  );

-- 策略3：客户可以提交举报（仅 reporter_role = 'customer'）
CREATE POLICY "reports.customer.insert"
  ON public.reports
  FOR INSERT
  WITH CHECK (
    reporter_role = 'customer'
    AND reporter_id = auth.uid()
  );

-- 策略4：管理员查看所有举报
CREATE POLICY "reports.admin.select"
  ON public.reports
  FOR SELECT
  USING (public.is_admin());

  -- 策略5：举报人可以更新自己的举报（仅限添加截图）
CREATE POLICY "reports.reporter.update"
  ON public.reports
  FOR UPDATE
  USING (reporter_id = auth.uid())
  WITH CHECK (reporter_id = auth.uid());

-- 策略6：管理员可以更新举报（处理状态、添加备注）
CREATE POLICY "reports.admin.update"
  ON public.reports
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 策略7：管理员可以删除举报
CREATE POLICY "reports.admin.delete"
  ON public.reports
  FOR DELETE
  USING (public.is_admin());

-- 授权
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT UPDATE, DELETE ON public.reports TO authenticated;
```

**说明**：
- 用户只能查看自己提交的举报记录
- 技师需验证身份（girls表关联），角色必须为 'girl'
- 客户直接提交，角色必须为 'customer'
- 用户不能更新或删除自己的举报
- 管理员拥有完全访问权限

### Storage Policies for uploads/reports 存储桶策略

```sql
-- 策略1：举报人可以上传截图到自己的举报目录
CREATE POLICY "reports_uploads.reporter.insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'reports'
  AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE (storage.foldername(name))[2] = r.id::text
      AND r.reporter_id = auth.uid()
  )
);

-- 策略2：举报人可以读取自己举报的截图
CREATE POLICY "reports_uploads.reporter.select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'reports'
  AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE (storage.foldername(name))[2] = r.id::text
      AND r.reporter_id = auth.uid()
  )
);

-- 策略3：管理员可以读取所有举报截图
CREATE POLICY "reports_uploads.admin.select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'reports'
  AND public.is_admin()
);

-- 策略4：管理员可以删除举报截图
CREATE POLICY "reports_uploads.admin.delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'reports'
  AND public.is_admin()
);
```

---

## 触发器

### 价格范围验证
```sql
CREATE OR REPLACE FUNCTION validate_girl_service_price()
RETURNS TRIGGER AS $$
DECLARE
    duration_record service_durations%ROWTYPE;
BEGIN
    IF NEW.custom_price IS NOT NULL THEN
        SELECT * INTO duration_record 
        FROM service_durations sd
        JOIN admin_girl_services ags ON ags.service_id = sd.service_id
        WHERE ags.id = NEW.admin_girl_service_id 
        AND sd.id = NEW.service_duration_id;
        
        IF NEW.custom_price < duration_record.min_price OR NEW.custom_price > duration_record.max_price THEN
            RAISE EXCEPTION 'Custom price % is not within allowed range % - %', 
                NEW.custom_price, duration_record.min_price, duration_record.max_price;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_girl_service_price_trigger
    BEFORE INSERT OR UPDATE ON girl_service_durations
    FOR EACH ROW
    EXECUTE FUNCTION validate_girl_service_price();

```

### 自动更新女孩位置的
```sql
CREATE OR REPLACE FUNCTION update_girls_status_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
        NEW.location_geom = ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_girls_status_location_trigger
    BEFORE INSERT OR UPDATE ON girls_status
    FOR EACH ROW
    EXECUTE FUNCTION update_girls_status_location();

```


### 创建确保每个客户端users用户只有一个主登录方式的触发器函数
```sql
CREATE OR REPLACE FUNCTION ensure_single_primary_account()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果新记录设为主要登录方式，则将该用户的其他记录设为非主要
    IF NEW.is_primary = true THEN
        UPDATE user_connected_accounts 
        SET is_primary = false 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER ensure_single_primary_account_trigger
    BEFORE INSERT OR UPDATE ON user_connected_accounts
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_account();

 ```

### 当有新用户插入 auth.users 时触发（仅处理客户端用户）
```sql
-- 函数：当 auth.users 插入新用户时，自动在 user_profiles 建档
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- 避免重复插入
  if exists (select 1 from public.user_profiles where id = new.id) then
    return new;
  end if;

  insert into public.user_profiles (
    id,
    username,
    display_name,
    avatar_url,
    language_code,
    level,
    experience,
    credit_score,
    notification_settings,
    preferences,
    is_banned,
    created_at,
    updated_at
  )
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data->>'full_name', 'Guest'),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    coalesce(new.raw_user_meta_data->>'language', 'en'),
    1, 0, 80,
    '{"email":true,"push":true,"sms":false}'::jsonb,
    '{}'::jsonb,
    false, now(), now()
  );

  return new;
end;
$$;

-- 触发器：监听 auth.users 新增
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
 ```


### 地址数量限制（新增）

```sql
-- 限制每个用户最多 5 条地址
create or replace function enforce_max_5_addresses()
returns trigger as $$
begin
  if (select count(*) from user_addresses where user_id = new.user_id) >= 5 then
    raise exception 'You can only save up to 5 addresses.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_max_5_addresses on user_addresses;

create trigger trg_enforce_max_5_addresses
before insert on user_addresses
for each row
execute procedure enforce_max_5_addresses();

 ```

### 女孩自动生成工号

```sql
 -- 创建函数：在插入前自动生成工号
CREATE OR REPLACE FUNCTION assign_girl_number()
RETURNS TRIGGER AS $$
DECLARE
  max_number INTEGER;
BEGIN
  -- 若已有手动指定值，则直接使用
  IF NEW.girl_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 查找当前最大工号
  SELECT MAX(girl_number) INTO max_number FROM public.girls;

  -- 若无记录，从1001开始
  IF max_number IS NULL THEN
    NEW.girl_number := 1001;
  ELSE
    NEW.girl_number := max_number + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建新触发器
CREATE TRIGGER trg_assign_girl_number
BEFORE INSERT ON public.girls
FOR EACH ROW
EXECUTE FUNCTION assign_girl_number();

 ```

### orders触发器：自动生成订单号

```sql
-- 创建序列（用于订单号递增）
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- 自动生成订单号函数
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
  mixed_val BIGINT;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    seq_val := NEXTVAL('order_number_seq');        -- 全局唯一
    mixed_val := (seq_val * 73 + 17) % 10000;      -- 通过哈希打散，不循环
    NEW.order_number := 'ORD-' ||
                        TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                        LPAD(mixed_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

```

### orders触发器：自动更新 updated_at
```sql
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()...
```


### orders触发器：自动更新取消的订单状态

```sql
CREATE OR REPLACE FUNCTION public.auto_update_order_cancelled()
RETURNS TRIGGER AS $$
DECLARE
    v_current_status TEXT;
BEGIN
    -- 获取订单当前状态
    SELECT status INTO v_current_status
    FROM public.orders
    WHERE id = NEW.order_id;
    
    -- 如果订单不存在，抛出异常
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Order not found: %', NEW.order_id;
    END IF;
    
    -- 如果订单已经是取消状态，不允许重复取消
    IF v_current_status = 'cancelled' THEN
        RAISE EXCEPTION 'Order % is already cancelled', NEW.order_id;
    END IF;
    
    -- 记录取消前状态
    NEW.previous_status := v_current_status;
    
    -- 更新订单状态为 cancelled
    UPDATE public.orders
    SET status = 'cancelled',
        cancelled_at = NEW.cancelled_at,
        cancelled_by = NEW.cancelled_by_user_id
    WHERE id = NEW.order_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

 ```

### orders触发器：自动更新取消的订单状态

```sql
 -- =====================================================
-- 当订单创建时，自动在 c2g 会话中插入"订单已创建"系统消息
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_order_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
  v_service_name_en TEXT;
BEGIN
  -- Extract English service name from JSONB
  v_service_name_en := NEW.service_name->>'en';
  
  -- Send system message to c2g thread
  BEGIN
    SELECT public.send_system_message_c2g(
      NEW.user_id,
      NEW.girl_id,
      'Order #' || NEW.order_number || ' has been created for ' || COALESCE(v_service_name_en, 'service') || '.',
      NEW.id
    ) INTO v_thread_id;
    
    -- Log success
    RAISE NOTICE 'System message sent to thread % for order %', v_thread_id, NEW.order_number;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the order creation
    RAISE WARNING 'Failed to send system message for order %: %', NEW.order_number, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table (AFTER INSERT)
DROP TRIGGER IF EXISTS trg_order_created_system_message ON public.orders;

CREATE TRIGGER trg_order_created_system_message
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_created();

  ```


### order_reviews触发器： 自动计算 rating_overall

```sql

CREATE OR REPLACE FUNCTION public.calculate_rating_overall()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动计算三项平均分（不含相似度）
    NEW.rating_overall := ROUND(
        (NEW.rating_service + NEW.rating_attitude + NEW.rating_emotion) / 3.0, 
        2
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_rating_overall
    BEFORE INSERT OR UPDATE ON public.order_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_rating_overall();
```

---

## 结算系统触发器

### girls触发器：自动创建状态和结算账户

```sql
-- 当插入新技师时自动创建 girls_status 和 girl_settlement_accounts 记录
CREATE OR REPLACE FUNCTION public.handle_new_girl()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 创建技师状态记录
  INSERT INTO public.girls_status (girl_id, status, last_session_seconds, total_online_seconds, updated_at)
  VALUES (NEW.id, 'offline', 0, 0, NOW())
  ON CONFLICT (girl_id) DO NOTHING;

  -- 创建结算账户记录（最低提现标准从配置读取）
  INSERT INTO public.girl_settlement_accounts (girl_id, deposit_amount, balance, currency)
  VALUES (NEW.id, 0, 0, 'THB')
  ON CONFLICT (girl_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_girl
  AFTER INSERT ON public.girls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_girl();
```

### orders触发器：订单完成时自动创建结算记录

```sql
-- 当订单状态变为 completed 时，自动创建结算记录并更新账户余额
CREATE OR REPLACE FUNCTION public.calculate_order_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- 详见 docs/sql/settlement_triggers.sql
$$;

CREATE TRIGGER trg_order_completed_settlement
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.calculate_order_settlement();
```

**说明**：
- 读取服务提成比例（services.commission_rate 或全局配置）
- 读取额外费用提成比例（app_configs）
- 计算平台应得金额 = service_fee × 提成比例 + extra_fee × 提成比例
- 创建 order_settlements 记录（订单流水）
- 更新 girl_settlement_accounts.balance
- 检查是否超过欠款阈值（使用 deposit_amount）
- **不再**记录到 settlement_transactions（订单流水由 order_settlements 承担）

### order_settlements触发器：同步更新账户余额

```sql
-- 当订单结算记录更新时（如管理员记录顾客支付），同步更新账户余额
CREATE OR REPLACE FUNCTION public.sync_settlement_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- 详见 docs/sql/settlement_triggers.sql
$$;

CREATE TRIGGER trg_sync_settlement_balance
  AFTER UPDATE ON public.order_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_settlement_balance();
```

**完整代码**：`docs/sql/settlement_triggers.sql`

```