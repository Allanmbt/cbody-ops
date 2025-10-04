## 管理员资料访问策略

### 1. 超级管理员可以查看所有管理员
```sql
-- 这里写 SQL
CREATE POLICY "superadmin_can_view_all_admins" ON admin_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'superadmin' AND is_active = true
        )
    );

```

### 2. 管理员可以查看自己的资料
```sql
CREATE POLICY "admin_can_view_own_profile" ON admin_profiles
    FOR SELECT USING (id = auth.uid());

```

### 3. 超级管理员可以更新其他管理员资料
```sql
CREATE POLICY "superadmin_can_update_admins" ON admin_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'superadmin' AND is_active = true
        )
    );

```

### 4. 管理员可以更新自己的显示名（通过应用层控制具体可更新的字段）
```sql
CREATE POLICY "admin_can_update_own_profile" ON admin_profiles
    FOR UPDATE USING (id = auth.uid());

```

### 5. 超级管理员可以插入新的管理员资料（当通过代码创建时）
```sql
CREATE POLICY "superadmin_can_insert_admin_profiles" ON admin_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'superadmin' AND is_active = true
        )
    );

```

## 操作日志访问策略
```sql
CREATE POLICY "superadmin_can_view_operation_logs" ON admin_operation_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'superadmin' AND is_active = true
        )
    );

CREATE POLICY "superadmin_can_insert_operation_logs" ON admin_operation_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'superadmin' AND is_active = true
        )
    );

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
### 女孩自己可以更新
```sql
CREATE POLICY "Girls can update their own profile" 
    ON girls FOR UPDATE 
    USING (auth.uid() = user_id);

```
### 管理员全权限
```sql
CREATE POLICY "Girls are manageable by admins" 
    ON girls FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

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
    ON girls_status FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

```

## girls_media表策略

### 读取权限
```sql
CREATE POLICY "Girls media are viewable by everyone" 
    ON girls_media FOR SELECT 
    USING (true);

```
### 女孩自己可以更新
```sql
CREATE POLICY "Girls can manage their own media" 
    ON girls_media FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM girls g 
        WHERE g.id = girl_id AND g.user_id = auth.uid()
    ));

```
### 管理员全权限
```sql
CREATE POLICY "Girls media are manageable by admins" 
    ON girls_media FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

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
    USING (auth.jwt() ->> 'role' = 'admin');

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
    USING (auth.jwt() ->> 'role' = 'admin');

```

## user_profiles 表策略
```sql
-- 用户可以查看自己的资料
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- 用户可以更新自己的资料
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 用户可以插入自己的资料（通过触发器自动创建）
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 超级管理员可以查看所有用户资料
CREATE POLICY "Superadmin can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role = 'superadmin' 
            AND is_active = true
        )
    );

-- 超级管理员可以更新所有用户资料
CREATE POLICY "Superadmin can update all profiles" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role = 'superadmin' 
            AND is_active = true
        )
    );

-- 管理员可以查看用户资料（用于订单管理等）
CREATE POLICY "Admin can view user profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'admin') 
            AND is_active = true
        )
    );

-- 技师可以查看已完成订单客户的基本信息（用于评价客户） 暂未添加 等orders表做好再添加！！！！！！！！！！！！！！！！！！！！！！！
CREATE POLICY "Girls can view customer profiles for completed orders" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN girls g ON g.id = o.girl_id
            WHERE g.user_id = auth.uid()
            AND o.user_id = user_profiles.id
            AND o.status = 'completed'
        )
    );

```

## user_login_events  表策略
```sql
-- 用户可以查看自己的登录历史
CREATE POLICY "Users can view own login events" ON user_login_events
    FOR SELECT USING (auth.uid() = user_id);

-- 系统可以插入登录记录（通过服务端函数）
CREATE POLICY "System can insert login events" ON user_login_events
    FOR INSERT WITH CHECK (true);

-- 管理员可以查看所有登录记录
CREATE POLICY "Admin can view all login events" ON user_login_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'admin') 
            AND is_active = true
        )
    );

```

## user_connected_accounts  表策略
```sql
-- 用户可以查看自己的绑定账户
CREATE POLICY "Users can view own connected accounts" ON user_connected_accounts
    FOR SELECT USING (auth.uid() = user_id);

-- 用户可以管理自己的绑定账户
CREATE POLICY "Users can manage own connected accounts" ON user_connected_accounts
    FOR ALL USING (auth.uid() = user_id);

-- 管理员可以查看所有绑定账户
CREATE POLICY "Admin can view all connected accounts" ON user_connected_accounts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() 
            AND role IN ('superadmin', 'admin') 
            AND is_active = true
        )
    );

```

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
