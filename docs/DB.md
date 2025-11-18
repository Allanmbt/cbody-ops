# CBODY上门服务平台数据库设计文档

## 数据库架构概览

本文档详细说明了CBODY上门服务平台的数据库架构设计。系统从UniCloud迁移到Supabase平台，根据业务需求和性能考虑进行了全面优化。

### 主要优化方向

1. **统一多语言支持**：采用JSONB类型统一存储多语言内容
2. **关系模型规范化**：正确使用外键关系和中间表
3. **数据类型优化**：选择更合适的数据类型和约束
4. **高频更新数据分离**：将频繁更新的状态和位置信息分离
5. **命名规范统一**：采用一致、清晰的命名约定
6. **性能索引优化**：添加适当的索引支持高效查询
7. **地理空间支持**：利用PostGIS支持高效地理位置搜索

## 详细表结构设计

## cities（城市表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | SERIAL | 是 | - | 主键，自增整数ID |
| code | VARCHAR(20) | 是 | - | 城市缩写代码，如 "BKK", "CNX", "HKT" |
| name | JSONB | 是 | '{"en":"","zh":"","th":""}' | 多语言城市名称 |
| country_code | VARCHAR(3) | 是 | - | 国家代码，ISO 3166-1 alpha-3，如 "THA" |
| lat | DOUBLE PRECISION | 是 | - | 纬度 |
| lng | DOUBLE PRECISION | 是 | - | 经度 |
| timezone | VARCHAR(50) | 否 | NULL | 时区，如 "Asia/Bangkok" |
| is_active | BOOLEAN | 否 | true | 是否激活，控制城市可见性 |
| sort_order | INTEGER | 否 | 999 | 排序优先级，数值越小越靠前 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |
| location_geom | GEOGRAPHY | 否 | NULL | 地理位置点，PostGIS地理查询支持 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_cities_code (code)
- INDEX idx_cities_country_code (country_code)
- INDEX idx_cities_active (is_active) WHERE is_active = true
- INDEX idx_cities_sort (sort_order, id)
- INDEX idx_cities_location ON cities USING GIST(location_geom)
- INDEX idx_cities_name_gin ON cities USING GIN(name)

## categories（分类表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | SERIAL | 是 | - | 主键，自增整数ID |
| code | VARCHAR(20) | 是 | - | 分类代码，如 "wellness", "homeHub", "journey" |
| name | JSONB | 是 | '{"en":"","zh":"","th":""}' | 多语言分类名称 |
| is_active | BOOLEAN | 否 | true | 是否激活，控制分类可见性 |
| sort_order | INTEGER | 否 | 999 | 排序优先级，数值越小越靠前 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_categories_code (code)
- INDEX idx_categories_active (is_active) WHERE is_active = true
- INDEX idx_categories_sort (sort_order, id)
- INDEX idx_categories_name_gin ON categories USING GIN(name)

## girls（女孩基本信息表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | uuid_generate_v4() | 主键 |
| user_id | UUID | 否 | NULL | Supabase 用户ID |
| city_id | INTEGER | 否 | NULL | 城市ID |
| telegram_id | BIGINT | 否 | NULL | Telegram 群组 ID |
| girl_number | SERIAL / INTEGER | 否 | 1001起 | 数据库触发器自增 |
| username | VARCHAR(50) | 是 | - | 唯一用户名，用于URL路径 |
| name | VARCHAR(50) | 是 | - | 显示昵称，可重复 |
| profile | JSONB | 是 | '{"en":"","zh":"","th":""}' | 多语言简介 |
| avatar_url | TEXT | 否 | NULL | 头像URL |
| birth_date | DATE | 否 | NULL | 出生日期 |
| height | SMALLINT | 否 | NULL | 身高（cm） |
| weight | SMALLINT | 否 | NULL | 体重（kg） |
| measurements | VARCHAR(15) | 否 | NULL | 三围 |
| gender | SMALLINT | 是 | 0 | 性别（0:女, 1:男） |
| languages | JSONB | 否 | '{}' | 会的语言及熟练度 |
| tags | JSONB | 是 | '{"en":"","zh":"","th":""}' | 多语言个人特征标签 |
| badge | TEXT | 否 | NULL | 奖章标识（new/hot/top_rated） |
| rating | DECIMAL(3,2) | 否 | 0 | 评分 |
| total_sales | INTEGER | 否 | 0 | 接单总量 |
| total_reviews | INTEGER | 否 | 0 | 评论总数 |
| max_travel_distance | INTEGER | 否 | 15 | 最大服务距离（km） |
| trust_score | SMALLINT | 是 | 80 | 诚信分（范围 0-100）默认80 |
| work_hours | JSONB | 否 | '{"start": "19:00", "end": "10:00"}' | 工作时间段 |
| is_verified | BOOLEAN | 否 | false | 是否已认证 |
| is_blocked | BOOLEAN | 否 | false | 是否被屏蔽 |
| is_visible_to_thai | BOOLEAN | 否 | true | 泰国用户是否可见 |
| sort_order | INTEGER | 否 | 999 | 排序优先级 |
| withdrawal_info | JSONB | 否 | '{"payment_method":"bank","bank_name":"","account_holder":"","account_number":"","qr_code_url":"","updated_at":null}' | 技师提现收款信息 |
| previous_user_id | UUID | 否 | NULL | 注销留痕：最近一次绑定的用户ID（用于回收旧档） |
| deleted_at | TIMESTAMPTZ | 否 | NULL | 软删除时间（账号注销/解绑时标记） |
| deleted_reason | TEXT | 否 | NULL | 删除原因（如 user_requested） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_girls_username (username)
- UNIQUE INDEX idx_girls_girl_number (girl_number)
- INDEX idx_girls_user_id (user_id) WHERE user_id IS NOT NULL;
- INDEX idx_girls_city_id (city_id)
- INDEX idx_girls_category_array ON public.girls USING GIN (category_id);
- INDEX idx_girls_rating (rating DESC)
- INDEX idx_girls_badge (badge) WHERE badge IS NOT NULL
- INDEX idx_girls_total_sales (total_sales DESC)
- INDEX idx_girls_trust_score ON girls(trust_score);
- INDEX idx_girls_is_blocked ON public.girls (is_blocked);
- INDEX idx_girls_name_search ON girls USING GIN(to_tsvector('english', name))
- INDEX idx_girls_tags_gin ON girls USING GIN(tags)
- INDEX idx_girls_deleted_at (deleted_at) WHERE deleted_at IS NOT NULL
- INDEX idx_girls_previous_user (previous_user_id) WHERE previous_user_id IS NOT NULL

**CHECK约束**：
- CHECK (trust_score BETWEEN 0 AND 100);

**外键约束**：
- FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
- FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL

**说明**：
- 首次登录自动建档：通过 `ensure_girl_for_current_user()` RPC 创建最小记录（默认 `is_blocked=true`，`is_verified=false`），触发器 `handle_new_girl` 自动创建状态与结算账户。
- 注销时采用软删除与解绑：写入 `previous_user_id`、置 `user_id=NULL`、`deleted_at=NOW()`，可在下次登录时回收，避免重复建档。

## girls_status（女孩状态和位置表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | uuid_generate_v4() | 主键 |
| girl_id | UUID | 是 | - | 关联女孩ID |
| status | TEXT | 是 | 'offline' | 状态（available/busy/offline） |
| current_lat | DOUBLE PRECISION | 否 | NULL | 当前纬度 |
| current_lng | DOUBLE PRECISION | 否 | NULL | 当前经度 |
| standby_lat | DOUBLE PRECISION | 否 | NULL | 基地纬度 |
| standby_lng | DOUBLE PRECISION | 否 | NULL | 基地经度 |
| next_available_time | TIMESTAMPTZ | 否 | NULL | 下次可用时间（缓存值） |
| auto_status_update | BOOLEAN | 否 | false | 是否自动更新状态 |
| last_online_at | TIMESTAMPTZ | 否 | NULL | 最后上线时间 |
| last_offline_at | TIMESTAMPTZ | 否 | NULL | 最后下线时间 |
| last_session_seconds | BIGINT | 是 | 0 | 本次会话在线时长（秒） |
| total_online_seconds | BIGINT | 是 | 0 | 总累计在线时长（秒） |
| cooldown_until_at | TIMESTAMPTZ | 否 | NULL | 冷却截止时间（下班后6小时不可上班） |
| last_seen_at | TIMESTAMPTZ | 否 | NULL | 最后心跳时间（App活跃检测） |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |
| location_geom | GEOGRAPHY | 否 | NULL | 地理位置点 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_girls_status_girl_id (girl_id)
- INDEX idx_girls_status_status (status)
- INDEX idx_girls_status_geom ON girls_status USING GIST(location_geom)
- INDEX idx_girls_status_next_time (next_available_time) WHERE next_available_time IS NOT NULL
- INDEX idx_girls_status_last_online (last_online_at DESC) WHERE last_online_at IS NOT NULL
- INDEX idx_girls_status_cooldown (cooldown_until_at) WHERE cooldown_until_at IS NOT NULL
- INDEX idx_girls_status_last_seen (last_seen_at DESC) WHERE last_seen_at IS NOT NULL

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (last_session_seconds >= 0)
- CHECK (total_online_seconds >= 0)

技师在线时长统计功能，包括实时会话、7天、月度和总计统计，并支持冷却期管理和心跳检测。

## girl_work_sessions（技师工作会话统计表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | uuid_generate_v4() | 主键 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| session_type | session_type | 是 | - | 会话类型枚举（online/order） |
| started_at | TIMESTAMPTZ | 是 | - | 会话开始时间 |
| ended_at | TIMESTAMPTZ | 是 | - | 会话结束时间 |
| duration_seconds | BIGINT | 是 | - | 会话时长（秒） |
| amount | DECIMAL(10,2) | 否 | NULL | 订单金额（仅订单会话） |
| order_id | UUID | 否 | NULL | 关联订单ID（仅订单会话） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 记录创建时间 |

**枚举类型**：
- session_type: `online`（在线会话）, `order`（订单会话）

**索引**：
- PRIMARY KEY (id)
- INDEX idx_sessions_girl_ended (girl_id, ended_at DESC)
- INDEX idx_sessions_girl_type_ended (girl_id, session_type, ended_at DESC)
- INDEX idx_sessions_order (order_id) WHERE order_id IS NOT NULL
- INDEX idx_sessions_created (created_at DESC)

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (duration_seconds >= 0)
- CHECK (amount IS NULL OR amount >= 0)
- CHECK (ended_at > started_at)
- CHECK (session_type != 'online' OR (order_id IS NULL AND amount IS NULL))
- CHECK (session_type != 'order' OR order_id IS NOT NULL)

**辅助函数**：
- `get_girl_online_hours_last_n_days(girl_id, days)` - 获取最近N天在线时长
- `get_girl_monthly_revenue(girl_id, months)` - 获取最近N个月收入统计
- `get_girl_daily_revenue(girl_id, days)` - 获取最近N天每日统计

技师工作会话记录表，支持真正的滚动时间窗口统计（最近7天/30天在线时长、月度收入等），替代锚点累加方式，数据永远准确。订单完成和技师下线时自动记录。


## girls_media（技师媒体表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| girl_id | UUID | 是 | - | 关联技师ID |
| kind | media_kind | 是 | - | 媒体类型（image/video/live_photo） |
| provider | TEXT | 是 | 'supabase' | 存储提供商（supabase/cloudflare） |
| storage_key | TEXT | 是 | - | 主资源路径（supabase: image.jpg; cloudflare: video_uid） |
| thumb_key | TEXT | 否 | NULL | 缩略图/封面路径 |
| meta | JSONB | 是 | '{}'::jsonb | 轻元数据（mime/size/width/height/duration/live_photo配对信息） |
| min_user_level | SMALLINT | 是 | 0 | 会员最低可见等级（0=公开） |
| status | media_status | 是 | 'pending' | 审核状态（pending/approved/rejected） |
| reviewed_by | UUID | 否 | NULL | 审核人ID |
| reviewed_at | TIMESTAMPTZ | 否 | NULL | 审核时间 |
| reject_reason | TEXT | 否 | NULL | 审核驳回原因 |
| sort_order | INTEGER | 是 | 0 | 技师可调整排序 |
| created_by | UUID | 是 | - | 创建者（技师对应的 auth.uid） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_gm_girl_sort (girl_id, sort_order)
- INDEX idx_gm_status (status)
- INDEX idx_gm_level (min_user_level)

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL

**枚举类型**：
- media_kind: 'image', 'video', 'live_photo'
- media_status: 'pending', 'approved', 'rejected'

**provider 说明**：
- `supabase`: 照片存储在 Supabase Storage，storage_key 为完整路径
- `cloudflare`: 视频存储在 Cloudflare Stream，storage_key 为 video UID

**meta 字段结构示例**：
```json
{
  "mime": "image/jpeg",
  "size": 1024000,
  "width": 1920,
  "height": 1080,
  "duration": 15,
  "cloudflare": {
    "uid": "video_unique_id",
    "ready": true
  },
  "live": {
    "image_key": "path/to/image.jpg",
    "video_key": "path/to/video.mov"
  }
}

```

## girls_categories（技师分类关联表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| category_id | INTEGER | 是 | - | 分类ID，关联categories表 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |

**索引**：
- PRIMARY KEY (girl_id, category_id)
- INDEX idx_girls_categories_girl_id (girl_id)
- INDEX idx_girls_categories_category_id (category_id)

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT


## services（服务项目表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | SERIAL | 是 | - | 主键，自增整数ID |
| category_id | INTEGER | 是 | - | 分类ID，关联categories表 |
| code | VARCHAR(50) | 是 | - | 服务代码，如 "thai_massage", "deep_tissue" |
| title | JSONB | 是 | '{"en":"","zh":"","th":""}' | 多语言服务标题 |
| description | JSONB | 是 | '{"en":"","zh":"","th":""}' | 多语言简介 |
| badge | VARCHAR(20) | 否 | NULL | 徽章标识，如 'TOP_PICK', 'HOT', 'NEW' 等 |
| is_active | BOOLEAN | 否 | true | 是否上架 |
| is_visible_to_thai | BOOLEAN | 否 | true | 泰文用户是否可见 |
| is_visible_to_english | BOOLEAN | 否 | true | 英文用户是否可见 |
| min_user_level | SMALLINT | 否 | 0 | 最小可见用户等级 |
| total_sales | INTEGER | 否 | 0 | 销量展示 |
| sort_order | INTEGER | 否 | 999 | 排序权重 |
|| commission_rate | DECIMAL(5,4) | 否 | NULL | 平台提成比例（0.4=40%，NULL时使用全局配置） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_services_code (code)
- INDEX idx_services_category_id (category_id)
- INDEX idx_services_active (is_active) WHERE is_active = true
- INDEX idx_services_sort (sort_order, id)
- INDEX idx_services_title_gin ON services USING GIN(title)
- INDEX idx_services_total_sales (total_sales DESC)
- INDEX idx_services_badge (badge) WHERE badge IS NOT NULL

**外键约束**：
- FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
- CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1))

## service_durations（服务时长定价表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | SERIAL | 是 | - | 主键 |
| service_id | INTEGER | 是 | - | 服务ID |
| duration_minutes | INTEGER | 是 | - | 时长（60/90/120...） |
| default_price | INTEGER | 是 | - | 管理员设置默认价（100泰铢整数倍） |
| min_price | INTEGER | 是 | - | 最低可调价（可选，若不设则不能低于默认价） |
| max_price | INTEGER | 是 | - | 最高可调价（可选） |
| is_active | BOOLEAN | 否 | true | 是否启用该时长 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_service_durations_service_id (service_id)
- INDEX idx_service_durations_duration (duration_minutes)
- INDEX idx_service_durations_active (is_active) WHERE is_active = true
- UNIQUE INDEX idx_service_durations_unique (service_id, duration_minutes)

**外键约束**：
- FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE

## admin_girl_services（管理员为技师绑定服务表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | uuid_generate_v4() | 主键 |
| girl_id | UUID | 是 | - | 技师ID |
| service_id | INTEGER | 是 | - | 服务ID |
| is_qualified | BOOLEAN | 是 | true | 是否合格提供此服务 |
| admin_id | UUID | 是 | - | 操作管理员ID |
| notes | TEXT | 否 | NULL | 管理员备注 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 绑定时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_admin_girl_services_girl_id (girl_id)
- INDEX idx_admin_girl_services_service_id (service_id)
- INDEX idx_admin_girl_services_admin_id (admin_id)
- INDEX idx_admin_girl_services_qualified (is_qualified) WHERE is_qualified = true
- UNIQUE INDEX idx_admin_girl_services_unique (girl_id, service_id)

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
- FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL

## girl_service_durations（技师服务时长配置表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | uuid_generate_v4() | 主键 |
| admin_girl_service_id | UUID | 是 | - | 关联admin_girl_services表 |
| service_duration_id | INTEGER | 是 | - | 关联service_durations表 |
| custom_price | INTEGER | 否 | NULL | 技师自定义价格（NULL则使用默认价格） |
| is_active | BOOLEAN | 否 | true | 技师是否提供该时长 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_girl_service_durations_admin_girl_service_id (admin_girl_service_id)
- INDEX idx_girl_service_durations_service_duration_id (service_duration_id)
- INDEX idx_girl_service_durations_active (is_active) WHERE is_active = true
- UNIQUE INDEX idx_girl_service_durations_unique (admin_girl_service_id, service_duration_id)

**外键约束**：
- FOREIGN KEY (admin_girl_service_id) REFERENCES admin_girl_services(id) ON DELETE CASCADE
- FOREIGN KEY (service_duration_id) REFERENCES service_durations(id) ON DELETE CASCADE

## user_profiles（用户资料表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | - | 主键，关联auth.users(id) |
| username | TEXT | 否 | NULL | 公开用户名，可重复可改 |
| display_name | TEXT | 否 | NULL | 显示名称，个人中心抬头用 |
| avatar_url | TEXT | 否 | NULL | 头像URL |
| phone_country_code | TEXT | 否 | +66 | 电话号码国家区号 |
| phone_number | TEXT | 否 | NULL | 电话号码 |
| country_code | VARCHAR(2) | 否 | NULL | ISO 3166-1 alpha-2，如TH/CN |
| language_code | VARCHAR(10) | 否 | 'en' | 语言偏好：en/zh/th（登录时从设备语言自动获取） |
| timezone | VARCHAR(50) | 否 | NULL | IANA时区，如Asia/Bangkok |
| gender | SMALLINT | 否 | 2 | 性别：0=男,1=女,2=不愿透露 |
| level | SMALLINT | 是 | 1 | 用户等级 |
| experience | INTEGER | 是 | 0 | 经验/积分累计 |
| credit_score | INTEGER | 是 | 80 | 信用分(技师评价影响) |
| notification_settings | JSONB | 否 | '{"email":true,"push":true,"sms":false}' | 通知偏好 |
| preferences | JSONB | 否 | '{}' | 其他前端偏好设置 |
| last_device_id | VARCHAR(100) | 否 | NULL | 最后登录设备ID |
| last_ip_address | INET | 否 | NULL | 最后登录IP |
| last_login_at | TIMESTAMPTZ | 否 | NULL | 最后登录时间 |
| is_whitelisted | BOOLEAN | 否 | false | 白名单标识：true 时豁免并发下单限制 |
| is_banned | BOOLEAN | 是 | false | 是否被封禁 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

-- 添加索引，优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_profiles_whitelisted 
ON public.user_profiles(id) 
WHERE is_whitelisted = true;

**索引**：
- PRIMARY KEY (id)
- INDEX idx_user_profiles_username (username) WHERE username IS NOT NULL
- INDEX idx_user_profiles_country (country_code)
- INDEX idx_user_profiles_level (level)
- INDEX idx_user_profiles_banned (id) WHERE is_banned = true
- INDEX idx_user_profiles_last_login (last_login_at DESC)
- INDEX idx_user_profiles_last_ip (last_ip_address)
- INDEX idx_user_profiles_whitelisted (user_profiles(id))
- INDEX idx_user_profiles_phone_country_code (phone_country_code)
- INDEX idx_user_profiles_phone_number (phone_number)


**外键约束**：
- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (gender IN (0, 1, 2))
- CHECK (level >= 1 AND level <= 9)
- CHECK (experience >= 0)
- CHECK (credit_score >= 0 AND credit_score <= 1000)
- CHECK (phone_country_code ~ '^\+[0-9]{1,3}$')
- CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{5,15}$')

## user_connected_accounts（第三方账户绑定表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| user_id | UUID | 是 | - | 关联用户ID |
| provider | VARCHAR(20) | 是 | - | 提供商：google/apple/facebook/line/kakao/wechat |
| provider_user_id | TEXT | 是 | - | 第三方用户ID |
| provider_email | VARCHAR(255) | 否 | NULL | 第三方邮箱 |
| is_primary | BOOLEAN | 否 | false | 是否为主登录方式 |
| linked_at | TIMESTAMPTZ | 是 | NOW() | 绑定时间 |
| last_used_at | TIMESTAMPTZ | 否 | NULL | 最后使用时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_user_connected_accounts_user_id (user_id)
- UNIQUE INDEX idx_user_connected_accounts_provider (provider, provider_user_id)
- INDEX idx_user_connected_accounts_primary (user_id) WHERE is_primary = true

**外键约束**：
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (provider IN ('google', 'apple', 'facebook', 'line', 'kakao', 'wechat'))

**触发器**：
- 确保每个用户只有一个主登录方式的触发器ensure_single_primary_account()

## user_addresses（用户地址簿）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| user_id | UUID | 是 | - | 所属用户ID，关联auth.users |
| place_id | TEXT | 否 | NULL | Google Place ID |
| place_name | TEXT | 是 | NULL | 地点名称（如酒店/公寓名） |
| formatted_address | TEXT | 否 | - | 统一展示用详细地址 |
| lat | DOUBLE PRECISION | 是 | - | 纬度 |
| lng | DOUBLE PRECISION | 是 | - | 经度 |
| location_type | TEXT | 否 | 'hotel' | 地址类型：hotel/condo_apartment/house/office/other |
| contact_name | TEXT | 否 | NULL | 联系人姓名（不填则沿用用户资料） |
| contact_phone | TEXT | 否 | NULL | 联系电话（不填则沿用用户资料） |
| note | TEXT | 否 | NULL | 备注（房号/门禁/车位/如何到达） |
| requires_lobby_pickup | BOOLEAN | 否 | NULL | 是否需大厅接送/带卡上楼 |
| entrance_photo_url | TEXT | 否 | NULL | 入口/门牌照片 |
| is_default | BOOLEAN | 是 | false | 是否默认地址（每用户唯一） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_user_addresses_user_id (user_id)
- INDEX idx_user_addresses_place_id (place_id) WHERE place_id IS NOT NULL
- UNIQUE INDEX idx_user_addresses_default (user_id) WHERE is_default = true
- INDEX idx_user_addresses_location (lat, lng) WHERE lat IS NOT NULL

**外键约束**：
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE


## user_favorites（用户收藏技师表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| user_id | UUID | 是 | - | 用户ID（收藏者），关联auth.users表 |
| girl_id | UUID | 是 | - | 被收藏技师ID，关联girls表 |
| is_active | BOOLEAN | 是 | true | 当前收藏状态（true=已收藏，false=已取消） |
| last_action_at | TIMESTAMPTZ | 是 | NOW() | 最后收藏/取消时间（防频繁操作） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 首次收藏时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_user_favorites_unique (user_id, girl_id)
- INDEX idx_user_favorites_user (user_id) WHERE is_active = true
- INDEX idx_user_favorites_girl (girl_id) WHERE is_active = true
- INDEX idx_user_favorites_created_at (created_at DESC)

**外键约束**：
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE

---

## orders（订单表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_number | VARCHAR(32) | 是 | - | 订单编号，唯一，格式：ORD-YYYYMMDD-XXXX,已触发器自动生成 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| user_id | UUID | 是 | - | 下单用户ID，关联auth.users表 |
| service_id | INTEGER | 是 | - | 服务ID，关联services表 |
| service_duration_id | INTEGER | 是 | - | 服务时长配置ID，关联service_durations表 |
| service_name | JSONB | 是 | '{"en":"","zh":"","th":""}' | 服务名称快照，多语言 |
| service_duration | INTEGER | 是 | - | 服务时长快照（分钟） |
| service_price | DECIMAL(10,2) | 是 | - | 服务价格快照（已含技师自定义价） |
| booking_mode | TEXT | 是 | 'now' | 预约模式：now（越快越好）/flex（指定时间段） |
| eta_minutes | INTEGER | 否 | NULL | Now模式：预计路程+缓冲时间（分钟） |
| estimated_arrival_at | TIMESTAMPTZ | 否 | NULL | Now模式：预计到达时间 |
| service_address_id | UUID | 否 | NULL | 用户选中的地址ID，关联user_addresses表 |
| address_snapshot | JSONB | 是 | '{}' | 地址完整快照（含联系人/电话/门禁/notes） |
| latitude | DOUBLE PRECISION | 否 | NULL | 服务地址纬度 |
| longitude | DOUBLE PRECISION | 否 | NULL | 服务地址经度 |
| distance | DECIMAL(10,2) | 否 | NULL | 服务距离（公里） |
| currency | VARCHAR(3) | 是 | 'THB' | 币种，默认泰铢 |
| service_fee | DECIMAL(10,2) | 是 | 0 | 服务费（价格明细） |
| travel_fee | DECIMAL(10,2) | 否 | 0 | 路程/出车费 |
| extra_fee | DECIMAL(10,2) | 否 | 0 | 额外费用 |
| discount_amount | DECIMAL(10,2) | 否 | 0 | 优惠金额 |
| total_amount | DECIMAL(10,2) | 是 | - | 订单总金额 |
| pricing_snapshot | JSONB | 是 | '{}' | 价格明细快照（行项目/规则来源） |
| status | TEXT | 是 | 'pending' | 订单状态 |
| service_started_at | TIMESTAMPTZ | 否 | NULL | 服务实际开始时间（状态变为in_service时自动记录） |
| completed_at | TIMESTAMPTZ | 否 | NULL | 订单完成时间（状态变为completed时自动记录） |
| scheduled_start_at | TIMESTAMPTZ | 否 | NULL | 系统计算的预计开始服务时间（串行排队链自动计算） |
| queue_position | INTEGER | 否 | NULL | 技师队列中的排序序号（从1开始，触发器自动维护） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**订单状态说明**：
- `pending` - 待确认
- `confirmed` - 已确认
- `en_route` - 在路上
- `arrived` - 已到达
- `in_service` - 服务中
- `completed` - 已完成
- `cancelled` - 已取消

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_orders_order_number (order_number)
- INDEX idx_orders_girl_id (girl_id)
- INDEX idx_orders_user_id (user_id)
- INDEX idx_orders_service_id (service_id)
- INDEX idx_orders_status (status)
- INDEX idx_orders_created_at (created_at DESC)
- INDEX idx_orders_booking_mode (booking_mode)
- INDEX idx_orders_completed_at (completed_at DESC) WHERE completed_at IS NOT NULL
- INDEX idx_orders_girl_status_scheduled (girl_id, status, scheduled_start_at)

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE RESTRICT
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
- FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
- FOREIGN KEY (service_duration_id) REFERENCES service_durations(id) ON DELETE SET NULL
- FOREIGN KEY (service_address_id) REFERENCES user_addresses(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (booking_mode IN ('now', 'flex'))
- CHECK (status IN ('pending', 'confirmed', 'en_route', 'arrived', 'in_service', 'completed', 'cancelled'))
- CHECK (total_amount >= 0)
- CHECK (service_price >= 0)
- CHECK (service_fee >= 0)
- CHECK (travel_fee >= 0)
- CHECK (extra_fee >= 0)
- CHECK (discount_amount >= 0)

**排队系统说明**：
- `scheduled_start_at` 和 `queue_position` 由 `maintain_girl_order_stats()` 触发器自动维护
- 采用**串行排队逻辑**：每次订单状态变化时，重新计算该技师的完整排队链
- 排队计算规则：
  - 优先使用 `service_started_at`（实际开始时间）
  - 其次使用 `estimated_arrival_at`（预计到达时间）
  - 最后使用 `created_at + eta_minutes`（创建时间+预计路程）
- 后续订单的 `scheduled_start_at` = MAX(前一单结束时间, 自己的候选开始时间)
- 配合 `girls_status.next_available_time` 字段，实现技师预计空闲时间的准确计算
- 仅活跃订单（confirmed/en_route/arrived/in_service）参与排队计算

---

## order_cancellations（订单取消记录表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_id | UUID | 是 | - | 订单ID，唯一，关联orders表 |
| cancelled_at | TIMESTAMPTZ | 是 | NOW() | 取消时间 |
| cancelled_by_role | TEXT | 是 | - | 取消方角色：user/therapist/admin/system |
| cancelled_by_user_id | UUID | 否 | NULL | 取消人用户ID，关联auth.users |
| reason_code | TEXT | 否 | NULL | 取消原因代码 |
| reason_note | TEXT | 否 | NULL | 取消原因备注 |
| previous_status | TEXT | 否 | NULL | 取消前订单状态 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 记录创建时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_order_cxl_order_id (order_id)
- INDEX idx_order_cxl_cancelled_at (cancelled_at DESC)
- INDEX idx_order_cxl_role (cancelled_by_role)
- INDEX idx_order_cxl_user_id (cancelled_by_user_id) WHERE cancelled_by_user_id IS NOT NULL

**外键约束**：
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
- FOREIGN KEY (cancelled_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (cancelled_by_role IN ('user', 'therapist', 'admin', 'system'))

---

## order_reviews（订单评价表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_id | UUID | 是 | - | 订单ID，关联orders表（唯一，同一订单仅能评价一次） |
| user_id | UUID | 是 | - | 评价人ID，关联auth.users表 |
| girl_id | UUID | 是 | - | 被评价技师ID，关联girls表 |
| service_id | INTEGER | 是 | - | 服务项目ID快照，关联services表 |
| rating_service | SMALLINT | 是 | - | 服务质量评分（1-5） |
| rating_attitude | SMALLINT | 是 | - | 服务态度评分（1-5） |
| rating_emotion | SMALLINT | 是 | - | 情绪价值评分（1-5） |
| rating_similarity | SMALLINT | 是 | - | 本人相似度评分（1-5） |
| rating_overall | DECIMAL(3,2) | 是 | 0 | 三项平均总分（不含相似度，触发器会自动计算，以实现） |
| comment_text | TEXT | 否 | NULL | 用户评价文字 |
| min_user_level | SMALLINT | 是 | 0 | 最低可见用户等级（0=公开） |
| status | TEXT | 是 | 'pending' | 审核状态：pending/approved/rejected |
| reviewed_by | UUID | 否 | NULL | 审核人ID，关联auth.users表 |
| reviewed_at | TIMESTAMPTZ | 否 | NULL | 审核时间 |
| reject_reason | TEXT | 否 | NULL | 审核驳回原因 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_order_reviews_order_id (order_id)
- INDEX idx_order_reviews_girl_id (girl_id)
- INDEX idx_order_reviews_user_id (user_id)
- INDEX idx_order_reviews_status (status)
- INDEX idx_order_reviews_girl_status (girl_id, status) WHERE status = 'approved'
- INDEX idx_order_reviews_created_at (created_at DESC)

**外键约束**：
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
- FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (rating_service BETWEEN 1 AND 5)
- CHECK (rating_attitude BETWEEN 1 AND 5)
- CHECK (rating_emotion BETWEEN 1 AND 5)
- CHECK (rating_similarity BETWEEN 1 AND 5)
- CHECK (rating_overall BETWEEN 1 AND 5)
- CHECK (status IN ('pending', 'approved', 'rejected'))
- CHECK (min_user_level >= 0)

---

## girl_settlement_accounts（技师结算账户表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表（唯一） |
| deposit_amount | DECIMAL(10,2) | 是 | 0 | 技师已付定金金额（也作为欠款阈值） |
| balance | DECIMAL(10,2) | 是 | 0 | 当前余额（正数=平台欠技师，负数=技师欠平台） |
| currency | VARCHAR(3) | 是 | 'THB' | 币种 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_girl_settlement_girl_id (girl_id)
- INDEX idx_girl_settlement_balance (balance)
- INDEX idx_girl_settlement_negative_balance (balance) WHERE balance < 0

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (deposit_amount >= 0)

**说明**：
- 每个技师一条记录，订单完成时自动更新余额
- `balance` 正数表示平台需付给技师，负数表示技师需付给平台
- `deposit_amount` 既记录实际定金，也作为欠款阈值（技师付多少定金就能欠多少）
- 最低提现标准统一使用配置表 `app_configs.settlement.default_min_withdrawal`
- 余额超过 `deposit_threshold` 负数阈值时禁止上线

---

## order_settlements（订单结算明细表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_id | UUID | 是 | - | 订单ID，关联orders表（唯一） |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| service_fee | DECIMAL(10,2) | 是 | - | 服务费快照 |
| extra_fee | DECIMAL(10,2) | 是 | 0 | 额外费用快照 |
| service_commission_rate | DECIMAL(5,4) | 是 | - | 服务提成比例快照（0.4=40%） |
| extra_commission_rate | DECIMAL(5,4) | 是 | - | 额外费用提成比例快照（0.2=20%） |
| platform_should_get | DECIMAL(10,2) | 是 | - | 平台应得=service_fee×service_rate+extra_fee×extra_rate |
| customer_paid_to_platform | DECIMAL(10,2) | 是 | 0 | 顾客已付给平台的金额 |
| settlement_amount | DECIMAL(10,2) | 是 | - | 结算金额=platform_should_get-customer_paid_to_platform |
| settlement_status | TEXT | 是 | 'pending' | 状态：pending/settled |
| settled_at | TIMESTAMPTZ | 否 | NULL | 结算时间 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_order_settlement_order_id (order_id)
- INDEX idx_order_settlement_girl_id (girl_id)
- INDEX idx_order_settlement_status (settlement_status)
- INDEX idx_order_settlement_pending (girl_id, created_at DESC) WHERE settlement_status = 'pending'

**外键约束**：
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE RESTRICT

**CHECK约束**：
- CHECK (settlement_status IN ('pending', 'settled'))
- CHECK (service_commission_rate >= 0 AND service_commission_rate <= 1)
- CHECK (extra_commission_rate >= 0 AND extra_commission_rate <= 1)
- CHECK (service_fee >= 0 AND extra_fee >= 0)
- CHECK (platform_should_get >= 0 AND customer_paid_to_platform >= 0)

**说明**：
- 订单完成时自动创建记录并计算
- `settlement_amount` 正数表示技师需付平台，负数表示平台需付技师
- 记录所有计算过程，便于对账
- **作为订单结算流水**，技师查看流水明细时使用此表

---

## settlement_transactions（结算交易记录表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| transaction_type | TEXT | 是 | - | 交易类型：deposit/payment/withdrawal/adjustment |
| amount | DECIMAL(10,2) | 是 | - | 交易金额（正数） |
| direction | TEXT | 是 | - | 资金流向：to_platform/to_girl |
| order_id | UUID | 否 | NULL | 关联订单ID（如果是订单结算） |
| order_settlement_id | UUID | 否 | NULL | 关联订单结算记录ID |
| payment_method | TEXT | 否 | NULL | 支付方式：cash/wechat/alipay/bank |
| payment_proof_url | TEXT | 否 | NULL | 支付凭证URL |
| notes | TEXT | 否 | NULL | 备注说明 |
| operator_id | UUID | 否 | NULL | 操作人ID（管理员） |
| approval_status | TEXT | 否 | 'pending' | 审核状态：pending/approved/rejected |
| approved_at | TIMESTAMPTZ | 否 | NULL | 审核时间 |
| reject_reason | TEXT | 否 | NULL | 拒绝原因 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_settlement_tx_girl_id (girl_id, created_at DESC)
- INDEX idx_settlement_tx_type (transaction_type)
- INDEX idx_settlement_tx_order (order_id) WHERE order_id IS NOT NULL
- INDEX idx_settlement_tx_operator (operator_id) WHERE operator_id IS NOT NULL
- INDEX idx_settlement_tx_approval_status (approval_status) WHERE approval_status = 'pending'

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
- FOREIGN KEY (order_settlement_id) REFERENCES order_settlements(id) ON DELETE SET NULL
- FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (transaction_type IN ('deposit', 'payment', 'withdrawal', 'adjustment'))
- CHECK (direction IN ('to_platform', 'to_girl'))
- CHECK (amount > 0)
- CHECK (approval_status IN ('pending', 'approved', 'rejected'))

**说明**：
- **专门记录需要审核或人工操作的申请/调整记录**
- 订单完成时**不再**自动生成记录（订单流水由 `order_settlements` 承担）
- `transaction_type` 说明：
  - `deposit`: 技师付定金
  - `payment`: 技师申请结账（需审核，有 `approval_status`）
  - `withdrawal`: 技师申请提现（需审核，有 `approval_status`）
  - `adjustment`: 管理员人工调整（直接批准，`approval_status = 'approved'`）
- `approval_status` 说明：
  - `pending`: 待审核（技师提交的申请）
  - `approved`: 已批准（管理员审核通过或管理员操作）
  - `rejected`: 已拒绝（管理员审核拒绝）
- 所有交易不可删除，仅可追加

---





## travel_od_dual（OD快照表 - 出行距离与时长缓存）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| origin_lat_snap | NUMERIC(9,6) | 是 | - | 起点纬度快照（精度6位小数，约0.1米） |
| origin_lng_snap | NUMERIC(9,6) | 是 | - | 起点经度快照（精度6位小数，约0.1米） |
| dest_lat_snap | NUMERIC(9,6) | 是 | - | 终点纬度快照（精度6位小数，约0.1米） |
| dest_lng_snap | NUMERIC(9,6) | 是 | - | 终点经度快照（精度6位小数，约0.1米） |
| distance_m | INTEGER | 是 | - | 距离（米） |
| duration_freeflow_s | INTEGER | 是 | - | 无拥堵时长（秒） |
| duration_traffic_s | INTEGER | 否 | - | 考虑实时路况时长（秒） |
| dest_place_id | TEXT | 否 | - | 目的地 Google Place ID（优先用于精确匹配）|
| travel_mode | TEXT | 是 | 'TWO_WHEELER' | 出行方式：TWO_WHEELER（摩托车）/DRIVING/WALKING |
| provider | TEXT | 否 | NULL | 数据提供商（如：routes_v2、google_maps） |
| observed_at | TIMESTAMPTZ | 是 | NOW() | 数据观测时间（路况实时快照时间） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 记录创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 记录更新时间 |
| valid_until | TIMESTAMPTZ | 是 | - | 缓存有效期至（过期后需重新请求） |


**说明**：
- 用于缓存技师→用户的出行距离与时长，减少对第三方路径规划API的调用
- `valid_until` 控制缓存过期，默认设置为 `observed_at + 180天`

**索引**：
- PRIMARY KEY (origin_lat_snap, origin_lng_snap, dest_lat_snap, dest_lng_snap)
- INDEX idx_od_dual_valid_until (valid_until)
- INDEX idx_od_dual_updated_at (updated_at DESC)
- INDEX idx_travel_od_origin_geom USING GIST (geography(ST_SetSRID(ST_Point(origin_lng_snap, origin_lat_snap), 4326)))
- INDEX idx_travel_od_dest_geom USING GIST (geography(ST_SetSRID(ST_Point(dest_lng_snap, dest_lat_snap), 4326)))
- INDEX idx_travel_od_dest_place (dest_place_id) 

**CHECK约束**：
- CHECK (distance_m > 0 AND duration_freeflow_s > 0 AND (duration_traffic_s IS NULL OR duration_traffic_s > 0))
- CHECK (valid_until > created_at)

---

<!-- 聊天表 -->

## chat_threads（聊天线程表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| thread_type | TEXT | 是 | - | 线程类型：c2g/s2c/s2g |
| customer_id | UUID | 否 | NULL | 客户ID（c2g/s2c线程使用） |
| girl_id | UUID | 否 | NULL | 技师ID（c2g/s2g线程使用） |
| support_id | UUID | 否 | NULL | 客服ID（s2c/s2g线程使用） |
| is_locked | BOOLEAN | 否 | false | 是否锁定（禁止发言） |
| temporary_unlock_until | TIMESTAMPTZ | 否 | NULL | 临时解锁截止时间 |
| last_message_at | TIMESTAMPTZ | 否 | NULL | 最后消息时间 |
| last_message_text | TEXT | 否 | NULL | 最后消息文本（用于列表展示） |
| last_push_to_customer_at | TIMESTAMPTZ | 否 | NULL | 最后一次推送给客户的时间（防30秒重复推送） |
| last_push_to_girl_at | TIMESTAMPTZ | 否 | NULL | 最后一次推送给技师的时间（防30秒重复推送） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_chat_threads_customer (customer_id, last_message_at DESC NULLS LAST)
- INDEX idx_chat_threads_girl (girl_id, last_message_at DESC NULLS LAST)
- INDEX idx_chat_threads_support (support_id, last_message_at DESC NULLS LAST)
- INDEX idx_chat_threads_type (thread_type)
- INDEX idx_chat_threads_push_customer (last_push_to_customer_at) WHERE last_push_to_customer_at IS NOT NULL
- INDEX idx_chat_threads_push_girl (last_push_to_girl_at) WHERE last_push_to_girl_at IS NOT NULL
- UNIQUE INDEX idx_chat_threads_c2g (customer_id, girl_id) WHERE thread_type = 'c2g'
- UNIQUE INDEX idx_chat_threads_s2c (support_id, customer_id) WHERE thread_type = 's2c'
- UNIQUE INDEX idx_chat_threads_s2g (support_id, girl_id) WHERE thread_type = 's2g'

**外键约束**：
- FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (support_id) REFERENCES auth.users(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (thread_type IN ('c2g', 's2c', 's2g'))
- CHECK (
    (thread_type = 'c2g' AND customer_id IS NOT NULL AND girl_id IS NOT NULL AND support_id IS NULL) OR
    (thread_type = 's2c' AND support_id IS NOT NULL AND customer_id IS NOT NULL AND girl_id IS NULL) OR
    (thread_type = 's2g' AND support_id IS NOT NULL AND girl_id IS NOT NULL AND customer_id IS NULL)
  )

---

## chat_messages（聊天消息表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| thread_id | UUID | 是 | - | 线程ID，关联chat_threads表 |
| sender_id | UUID | 是 | - | 发送者ID，关联auth.users表 |
| sender_role | TEXT | 是 | - | 发送者角色：customer/girl/support/system |
| content_type | TEXT | 是 | 'text' | 内容类型：text/image/system |
| text_content | TEXT | 否 | NULL | 文本内容 |
| attachment_url | TEXT | 否 | NULL | 附件URL（存储路径） |
| attachment_meta | JSONB | 否 | '{}' | 附件元数据：{mime, width, height, size} |
| client_msg_id | UUID | 是 | - | 客户端消息ID（用于去重） |
| order_id | UUID | 否 | NULL | 关联订单ID（用于审计） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_chat_messages_thread_time (thread_id, created_at DESC)
- INDEX idx_chat_messages_thread_id (thread_id, id)
- UNIQUE INDEX idx_chat_messages_dedup (thread_id, client_msg_id)
- INDEX idx_chat_messages_order (order_id) WHERE order_id IS NOT NULL
- INDEX idx_chat_messages_sender (sender_id)

**外键约束**：
- FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
- FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (sender_role IN ('customer', 'girl', 'support', 'system'))
- CHECK (content_type IN ('text', 'image', 'system'))
- CHECK (
    (content_type = 'text' AND text_content IS NOT NULL) OR
    (content_type = 'image' AND attachment_url IS NOT NULL) OR
    (content_type = 'system' AND text_content IS NOT NULL)
  )

---

## chat_receipts（消息已读记录表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| thread_id | UUID | 是 | - | 线程ID，关联chat_threads表 |
| user_id | UUID | 是 | - | 用户ID，关联auth.users表 |
| last_read_at | TIMESTAMPTZ | 是 | NOW() | 最后阅读时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (thread_id, user_id)
- INDEX idx_chat_receipts_user (user_id)

**外键约束**：
- FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE

---

## user_blocks（用户屏蔽表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| customer_id | UUID | 是 | - | 被屏蔽的客户ID，关联auth.users表 |
| is_active | BOOLEAN | 是 | true | 当前屏蔽状态（true=已屏蔽，false=已解除） |
| blocked_at | TIMESTAMPTZ | 是 | NOW() | 首次屏蔽时间 |
| unblocked_at | TIMESTAMPTZ | 否 | NULL | 最后解除屏蔽时间 |
| last_action_at | TIMESTAMPTZ | 是 | NOW() | 最后操作时间（防频繁操作） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_user_blocks_girl_active (girl_id, is_active) WHERE is_active = true
- UNIQUE INDEX idx_user_blocks_unique (girl_id, customer_id)
- INDEX idx_user_blocks_customer (customer_id, girl_id)
- INDEX idx_user_blocks_blocked_at (blocked_at DESC)

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE

**说明**：
- 仅技师端可以屏蔽客户，客户端无法屏蔽技师
- `is_active` 字段标识当前屏蔽状态，支持多次屏蔽/解除屏蔽
- `last_action_at` 用于防止频繁操作
- 技师+客户组合唯一（通过 UNIQUE 索引保证）

---


## app_devices（应用设备表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| user_id | UUID | 否 | NULL | 客户端登录用户ID，关联auth.users |
| girl_id | UUID | 否 | NULL | 技师端登录用户ID，关联girls表 |
| role | TEXT | 是 | - | 角色类型：client/girl |
| expo_push_token | TEXT | 是 | - | Expo推送Token |
| platform | TEXT | 是 | - | 平台：ios/android/web |
| device_id | TEXT | 是 | - | 设备唯一标识 |
| app_id | TEXT | 是 | - | 应用标识：cbody-client/cbody-go |
| app_version | TEXT | 否 | NULL | 应用版本号 |
| locale | TEXT | 否 | 'en' | 语言偏好：en/zh/th |
| timezone | TEXT | 否 | NULL | 时区，如 Asia/Bangkok |
| is_active | BOOLEAN | 是 | true | 是否激活 |
| last_seen_at | TIMESTAMPTZ | 是 | NOW() | 最后活跃时间 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_app_devices_token_app_role (expo_push_token, app_id, role) WHERE expo_push_token IS NOT NULL（允许同一设备的不同app使用相同token）
- INDEX idx_app_devices_user (user_id, is_active) WHERE user_id IS NOT NULL
- INDEX idx_app_devices_girl (girl_id, is_active) WHERE girl_id IS NOT NULL
- INDEX idx_app_devices_role_active (role, is_active) WHERE is_active = true
- INDEX idx_app_devices_device_app (device_id, app_id)
- INDEX idx_app_devices_last_seen (last_seen_at DESC)

**外键约束**：
- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (role IN ('client', 'girl'))
- CHECK (platform IN ('ios', 'android', 'web'))
- CHECK (
    (role = 'client' AND user_id IS NOT NULL AND girl_id IS NULL) OR
    (role = 'girl' AND girl_id IS NOT NULL AND user_id IS NULL)
  )


## admin_role（管理员角色枚举类型）

**枚举值**：
- `superadmin` - 超级管理员
- `admin` - 管理员  
- `finance` - 财务
- `support` - 客服

## admin_profiles（管理员资料表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | - | 主键，关联auth.users表 |
| display_name | TEXT | 是 | - | 显示名称 |
| role | admin_role | 是 | 'support' | 管理员角色 |
| is_active | BOOLEAN | 否 | true | 是否激活 |
| created_at | TIMESTAMPTZ | 否 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 否 | NOW() | 更新时间 |
| created_by | UUID | 否 | NULL | 创建者ID |
| updated_by | UUID | 否 | NULL | 更新者ID |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_admin_profiles_role (role)
- INDEX idx_admin_profiles_active (is_active) WHERE is_active = true
- INDEX idx_admin_profiles_created_by (created_by)

**外键约束**：
- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
- FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL

## admin_operation_logs（管理员操作日志表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| operator_id | UUID | 是 | - | 操作者ID |
| target_admin_id | UUID | 是 | - | 目标管理员ID |
| operation_type | TEXT | 是 | - | 操作类型（如 update_profile, reset_password, toggle_status） |
| operation_details | JSONB | 否 | NULL | 操作详情JSON数据 |
| created_at | TIMESTAMPTZ | 否 | NOW() | 操作时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_admin_operation_logs_operator_id (operator_id)
- INDEX idx_admin_operation_logs_target_admin_id (target_admin_id)
- INDEX idx_admin_operation_logs_operation_type (operation_type)
- INDEX idx_admin_operation_logs_created_at (created_at DESC)

**外键约束**：
- FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (target_admin_id) REFERENCES auth.users(id) ON DELETE CASCADE


## price_change_logs 表结构

### 表说明
记录技师的改价申请，包含反作弊机制（延迟生效 + 冷却时间）。

### 字段定义

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| admin_girl_service_id | UUID | 是 | - | 关联admin_girl_services表 |
| service_duration_id | INTEGER | 是 | - | 关联service_durations表 |
| old_price | INTEGER | 否 | NULL | 原价格（NULL表示首次设价） |
| new_price | INTEGER | 是 | - | 新价格 |
| status | TEXT | 是 | 'pending' | 状态：pending/applied/cancelled |
| requested_at | TIMESTAMPTZ | 是 | NOW() | 申请时间 |
| effective_at | TIMESTAMPTZ | 是 | NOW() + INTERVAL '30 minutes' | 生效时间（申请后30分钟） |
| applied_at | TIMESTAMPTZ | 否 | NULL | 实际应用时间 |
| notes | TEXT | 否 | NULL | 备注 |

### 索引

```sql
-- 主键
PRIMARY KEY (id)

-- 查询技师的改价记录
INDEX idx_price_change_logs_girl_id (girl_id)

-- 查询待应用的记录（定时作业用）
INDEX idx_price_change_logs_pending (status, effective_at) 
  WHERE status = 'pending'

-- 查询冷却时间（防止频繁改价）
INDEX idx_price_change_logs_cooldown (girl_id, admin_girl_service_id, service_duration_id, requested_at)

-- 关联查询
INDEX idx_price_change_logs_ags_id (admin_girl_service_id)
INDEX idx_price_change_logs_sd_id (service_duration_id)
```

### 外键约束

```sql
FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
FOREIGN KEY (admin_girl_service_id) REFERENCES admin_girl_services(id) ON DELETE CASCADE
FOREIGN KEY (service_duration_id) REFERENCES service_durations(id) ON DELETE CASCADE
```

### CHECK 约束

```sql
CHECK (status IN ('pending', 'applied', 'cancelled'))
CHECK (new_price > 0)
CHECK (new_price % 100 = 0)  -- 必须是100的整数倍
```


## app_configs（应用配置表）

### 表结构

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| namespace | TEXT | 是 | - | 命名空间（配置分组） |
| config_key | TEXT | 是 | - | 配置键 |
| scope | config_scope | 是 | 'global' | 作用域：global/city/app/user |
| scope_id | TEXT | 否 | NULL | 作用域ID（如APP区分，城市ID、用户ID） |
| locale | TEXT | 否 | NULL | 语言代码（en/zh/th） |
| dtype | config_dtype | 是 | 'json' | 数据类型：json/text/url |
| value_json | JSONB | 否 | NULL | JSON值（dtype=json时使用） |
| value_text | TEXT | 否 | NULL | 文本值（dtype=text时使用） |
| value_url | TEXT | 否 | NULL | URL值（dtype=url时使用） |
| is_active | BOOLEAN | 是 | true | 是否激活 |
| effective_from | TIMESTAMPTZ | 是 | NOW() | 生效开始时间 |
| effective_to | TIMESTAMPTZ | 否 | NULL | 生效结束时间 |
| priority | INTEGER | 是 | 100 | 优先级（数值越小越优先） |
| version | INTEGER | 是 | 1 | 版本号 |
| description | TEXT | 否 | NULL | 配置说明 |
| updated_by | UUID | 否 | auth.uid() | 更新人ID |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**枚举类型**：
- `config_scope`: 'global', 'city', 'app', 'user'
- `config_dtype`: 'json', 'text', 'url'

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX ux_app_configs_live (namespace, config_key, scope, COALESCE(scope_id,'__'), COALESCE(locale,'__')) WHERE is_active = true
- INDEX idx_cfg_ns_key (namespace, config_key)
- INDEX idx_cfg_scope (scope, scope_id)
- INDEX idx_cfg_time (is_active, effective_from, effective_to, priority)

**CHECK约束**：
- CHECK ((dtype='json' AND value_json IS NOT NULL) OR (dtype='text' AND value_text IS NOT NULL) OR (dtype='url' AND value_url IS NOT NULL))

**结算系统配置示例**：
- `settlement.extra_fee_commission_rate`: 额外费用提成比例
- `settlement.default_deposit_threshold`: 默认定金阈值
- `settlement.default_min_withdrawal`: 默认最低提现标准
- `settlement.cny_to_thb_rate`: 人民币对泰铢汇率
- `settlement.default_service_commission_rate`: 默认服务提成比例

---

## reports（举报表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| reporter_id | UUID | 是 | - | 举报人ID，关联auth.users表 |
| reporter_role | TEXT | 是 | - | 举报人角色：girl/customer |
| target_user_id | UUID | 是 | - | 被举报用户ID，关联auth.users表 |
| report_type | TEXT | 是 | - | 举报类型（见下方枚举） |
| description | TEXT | 否 | NULL | 举报描述（可选） |
| screenshot_urls | TEXT[] | 否 | '{}' | 截图URL列表（最多3张） |
| status | TEXT | 是 | 'pending' | 处理状态：pending/resolved |
| thread_id | UUID | 否 | NULL | 关联聊天线程ID（如果从聊天发起） |
| order_id | UUID | 否 | NULL | 关联订单ID（如果从订单发起） |
| reviewed_by | UUID | 否 | NULL | 处理人ID，关联auth.users表 |
| reviewed_at | TIMESTAMPTZ | 否 | NULL | 处理时间 |
| admin_notes | TEXT | 否 | NULL | 管理员备注 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**举报类型枚举**：
- `harassment` - 骚扰 / 不当言论
- `spam` - 垃圾消息 / 恶意骚扰
- `fake_booking` - 恶意下单 / 爽约
- `inappropriate_behavior` - 不当行为（服务过程中的不尊重）
- `dangerous_behavior` - 危险行为（毒品 / 暴力 / 醉酒）
- `privacy_violation` - 隐私与安全隐患（偷拍 / 录音 / 摄像头）
- `payment_issue` - 付款问题 / 欺诈行为
- `c_late_arrival` - 迟到过久
- `c_unprofessional_attitude` - 服务态度不佳
- `c_not_as_described` - 与描述不符
- `c_incomplete_service` - 服务缩短 / 偷钟
- `c_poor_condition` - 状态不佳（醉酒 / 疲劳）
- `c_inappropriate_behavior` - 不当行为
- `c_missing_uniform` - 未穿工作服
- `c_suspected_theft` - 可疑偷盗行为
- `c_dangerous_behavior` - 危险行为（暴力 / 毒品）
- `other` - 其他

**状态枚举**：
- `pending` - 待处理
- `resolved` - 已处理

**索引**：
- PRIMARY KEY (id)
- INDEX idx_reports_reporter (reporter_id, created_at DESC)
- INDEX idx_reports_target (target_user_id, created_at DESC)
- INDEX idx_reports_status (status, created_at DESC) WHERE status = 'pending'
- INDEX idx_reports_type (report_type)
- INDEX idx_reports_thread (thread_id) WHERE thread_id IS NOT NULL
- INDEX idx_reports_order (order_id) WHERE order_id IS NOT NULL
- INDEX idx_reports_created_at (created_at DESC)

**外键约束**：
- FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE
- FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE SET NULL
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
- FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (reporter_role IN ('girl', 'customer'))
- CHECK (report_type IN (
  'harassment',
  'spam',
  'fake_booking',
  'inappropriate_behavior',
  'dangerous_behavior',
  'privacy_violation',
  'payment_issue',

  -- 客户端新增类型
  'c_late_arrival',
  'c_unprofessional_attitude',
  'c_not_as_described',
  'c_incomplete_service',
  'c_poor_condition',
  'c_inappropriate_behavior',
  'c_missing_uniform',
  'c_suspected_theft',
  'c_dangerous_behavior',

  'other'
  ))
- CHECK (status IN ('pending', 'resolved'))
- CHECK (array_length(screenshot_urls, 1) IS NULL OR array_length(screenshot_urls, 1) <= 3)
- CHECK (reporter_id != target_user_id)

**说明**：
- 技师端与客户端共用此表
- 截图上传至 Supabase Storage `uploads/reports/{report_id}/` 目录
- 技师通过 `reporter_role = 'girl'` 区分，需要关联 `girls` 表验证身份
- 轻量化设计，无复杂工作流，仅 pending/resolved 两态
- 不自动封禁用户，由后台管理员手动处理

---