# RPC Supabase Function List

## 登录更新：只负责更新登录信息，不建档
```sql
create or replace function public.handle_login(
  p_user_id uuid,
  p_provider text,
  p_provider_user_id text default null,
  p_provider_email text default null,
  p_device_info jsonb default '{}'::jsonb,
  p_language_tag text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_login_method text;
  v_country text;
  v_timezone text;
  v_device_id text;
  v_ip inet;
  v_current_user_id uuid;
  v_update_count integer;
  v_account_id bigint;  -- 假设主键是 bigint，自行按表结构调整
  v_is_own boolean;
begin
  -- 1) 鉴权
  v_current_user_id := auth.uid();
  if v_current_user_id is null then raise exception 'Not authenticated'; end if;
  if v_current_user_id != p_user_id then raise exception 'Access denied'; end if;

  -- 2) 规范化 provider
  v_login_method := lower(coalesce(p_provider,'phone'));
  if v_login_method not in ('phone','google','apple','facebook') then v_login_method := 'phone'; end if;

  -- 3) 确保 profile 已存在（略）

  -- 4) 解析设备信息（略）

  -- 5) 更新 user_profiles（保持你原逻辑）
  update public.user_profiles
  set last_device_id = coalesce(v_device_id, last_device_id),
      last_ip_address = coalesce(v_ip, last_ip_address),
      last_login_at = now(),
      updated_at = now(),
      country_code = case when country_code is null and v_country is not null then v_country else country_code end,
      timezone = case when timezone   is null and v_timezone is not null then v_timezone   else timezone   end,
      preferences = case
        when preferences is null or preferences = '{}' then
          coalesce(jsonb_strip_nulls(jsonb_build_object(
            'deviceModel',  p_device_info->>'deviceModel',
            'osName',       p_device_info->>'osName',
            'osVersion',    p_device_info->>'osVersion',
            'appVersion',   p_device_info->>'appVersion'
          )), preferences)
        else preferences
      end
  where id = p_user_id;
  get diagnostics v_update_count = row_count;

 -- 6) 账户绑定（稳定幂等版）
if v_login_method in ('google','apple','facebook')
   and nullif(p_provider_user_id,'') is not null then

  -- 若该三方账号已绑定给别人，明确拒绝
  if exists (
    select 1 from public.user_connected_accounts
    where provider = v_login_method
      and provider_user_id = p_provider_user_id
      and user_id <> p_user_id
  ) then
    raise exception 'This % account is already linked to another user', v_login_method;
  end if;

  -- 自己的记录：upsert（不改 is_primary）
  insert into public.user_connected_accounts (
    user_id, provider, provider_user_id, provider_email, is_primary, linked_at, last_used_at
  )
  values (p_user_id, v_login_method, p_provider_user_id, p_provider_email, false, now(), now())
  on conflict (provider, provider_user_id) do update
    set provider_email = excluded.provider_email,
        last_used_at   = now();

  -- 原子地仅将当前这条设为主，其它全关
  update public.user_connected_accounts u
  set is_primary = (u.provider = v_login_method and u.provider_user_id = p_provider_user_id)
  where u.user_id = p_user_id;
end if;

  return jsonb_build_object(
    'success', true,
    'provider', v_login_method,
    'profile_updated', v_update_count > 0,
    'updated_at', now(),
    'message', 'Login info & bindings updated'
  );

exception when others then
  return jsonb_build_object(
    'success', false,
    'error', sqlerrm,
    'error_code', sqlstate,
    'user_id', p_user_id,
    'provider', p_provider
  );
end;
$$;

grant execute on function public.handle_login(uuid,text,text,text,jsonb,text) to authenticated;


```


## 设置某条地址为默认地址，同时清除同用户的其他默认
```sql
create or replace function set_default_address(address_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  uid uuid;
begin
  -- 找到该地址所属用户
  select user_id into uid
  from user_addresses
  where id = address_id;

  if uid is null then
    raise exception 'Address not found';
  end if;

  -- 只允许本人操作
  if auth.uid() <> uid then
    raise exception 'Permission denied';
  end if;

  -- 开启事务：先清空同用户的默认地址
  update user_addresses
  set is_default = false
  where user_id = uid;

  -- 再把当前地址设为默认
  update user_addresses
  set is_default = true
  where id = address_id;
end;
$$;

```

## 查询和更新绑定女孩分类
```sql
-- 视图：每位技师聚合出一个分类ID数组
CREATE OR REPLACE VIEW public.girls_with_category_ids AS
SELECT
  g.id AS girl_id,
  COALESCE(ARRAY_AGG(gc.category_id ORDER BY gc.category_id)
           FILTER (WHERE gc.category_id IS NOT NULL), '{}')::INTEGER[] AS category_ids
FROM public.girls g
LEFT JOIN public.girls_categories gc ON gc.girl_id = g.id
GROUP BY g.id;

-- 帮助函数：用一个数组“覆盖设置”某位技师的分类集合
CREATE OR REPLACE FUNCTION public.set_girl_categories(p_girl_id UUID, p_category_ids INTEGER[])
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.girls_categories WHERE girl_id = p_girl_id;

  IF p_category_ids IS NOT NULL THEN
    INSERT INTO public.girls_categories (girl_id, category_id)
    SELECT p_girl_id, unnest(p_category_ids);
  END IF;
END;
$$;

```
