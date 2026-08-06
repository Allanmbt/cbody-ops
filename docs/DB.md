# CBODY上门服务平台数据库设计文档

> **最近更新：2026-08-06（Asia/Shanghai）**
>
> 本次新增 `private_availability_settings`，用于持续保持技师当前可约状态和每天固定工作时间；原 `private_availability` 每日记录完整保留。原 CBODY / Outcall 表结构未修改。

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

## incall_locations（到店地址表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| name | TEXT | 是 | - | 地点名称，如 "Thai Heaven Spa · Room 301" |
| address | TEXT | 是 | - | 展示用详细地址 |
| lat | DOUBLE PRECISION | 是 | - | 纬度（用于地图跳转） |
| lng | DOUBLE PRECISION | 是 | - | 经度 |
| place_id | TEXT | 否 | NULL | Google Place ID（优先，跳地图更精准） |
| city_id | INTEGER | 否 | NULL | 城市ID，关联 cities(id) |
| photos | TEXT[] | 是 | '{}' | 房间/环境图片 URL 列表（建议最多 9 张） |
| meta | JSONB | 是 | '{}' | 扩展字段（楼层/门禁/停车/Wi-Fi 等） |
| is_active | BOOLEAN | 是 | true | 是否激活，控制可见性 |
| created_by | UUID | 否 | NULL | 创建人（管理员），关联 auth.users(id) |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_incall_locations_city (city_id) WHERE city_id IS NOT NULL
- INDEX idx_incall_locations_active (is_active) WHERE is_active = true
- INDEX idx_incall_locations_created_by (created_by) WHERE created_by IS NOT NULL

**外键约束**：
- FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
- FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL

**说明**：
- 支持多名技师共用同一条地址记录（如同一门店的多名技师）
- `meta` 字段预留扩展：`{"floor":"3F","entrance_note":"...","parking":"...","wifi":true}`
- `photos` 存储 Supabase Storage 图片 URL 列表，建议最多 9 张
- 地址的增删改由管理员在后台操作，技师不可自行修改

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
| incall_enabled | BOOLEAN | 是 | false | 是否支持到店接待（Incall） |
| incall_location_id | UUID | 否 | NULL | 关联到店地址ID，关联 incall_locations(id) |
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
- INDEX idx_girls_incall (incall_enabled) WHERE incall_enabled = true
- INDEX idx_girls_incall_location (incall_location_id) WHERE incall_location_id IS NOT NULL

**CHECK约束**：
- CHECK (trust_score BETWEEN 0 AND 100);

**外键约束**：
- FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
- FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
- FOREIGN KEY (incall_location_id) REFERENCES incall_locations(id) ON DELETE SET NULL

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

## add_time_packages（固定加钟套餐表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| duration_minutes | INTEGER | 是 | - | 加钟时长（30/60/120/360分钟） |
| commission_thb | DECIMAL(10,2) | 是 | - | 平台固定加钟佣金（THB） |
| is_active | BOOLEAN | 否 | true | 是否启用该加钟套餐 |
| sort_order | INTEGER | 否 | 100 | 排序权重 |
| notes | TEXT | 否 | NULL | 备注说明 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX ux_add_time_packages_duration (duration_minutes)
- INDEX idx_add_time_packages_active (sort_order, duration_minutes) WHERE is_active = true

**CHECK约束**：
- CHECK (duration_minutes IN (30, 60, 120, 360))
- CHECK (commission_thb >= 0)

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
| is_whitelisted | BOOLEAN | 否 | false | 白名单标识：true 时豁免并发下单限制和恶意取消检查 |
| temp_blocked_until | TIMESTAMPTZ | 否 | NULL | 临时禁止下单截止时间（NULL=未限制，用于恶意取消防范） |
| temp_block_reason | TEXT | 否 | NULL | 临时限制原因（如：频繁取消订单） |
| last_credit_recovery_at | TIMESTAMPTZ | 否 | NULL | 上次信用分恢复时间（预留字段，暂不启用自动恢复） |
| is_banned | BOOLEAN | 是 | false | 是否被封禁 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_user_profiles_username (username) WHERE username IS NOT NULL
- INDEX idx_user_profiles_country (country_code)
- INDEX idx_user_profiles_level (level)
- INDEX idx_user_profiles_banned (id) WHERE is_banned = true
- INDEX idx_user_profiles_last_login (last_login_at DESC)
- INDEX idx_user_profiles_last_ip (last_ip_address)
- INDEX idx_user_profiles_whitelisted (id) WHERE is_whitelisted = true
- INDEX idx_user_profiles_phone_country_code (phone_country_code)
- INDEX idx_user_profiles_phone_number (phone_number)
- INDEX idx_user_profiles_temp_blocked (temp_blocked_until) WHERE temp_blocked_until IS NOT NULL
- INDEX idx_user_profiles_credit_score (credit_score) WHERE credit_score < 80


**外键约束**：
- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (gender IN (0, 1, 2))
- CHECK (level >= 1 AND level <= 9)
- CHECK (experience >= 0)
- CHECK (credit_score >= 0 AND credit_score <= 100)
- CHECK (phone_country_code ~ '^\+[0-9]{1,3}$')
- CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{5,15}$')

**说明**：
- **恶意取消防范系统**（自动轻量限制，不涉及永久封禁）：
  - **触发A**：1小时内≥2次取消（不含arrived状态） → 临时禁止下单2小时
  - **触发B**：24小时内≥3次取消（不含arrived状态） → 临时禁止下单24小时 + 扣除12信用分
  - **奖励机制**：完成订单 → 信用分+2（最高100分）
  - **白名单豁免**：`is_whitelisted = true` 的用户豁免所有自动限制
  - **arrived取消**：技师已到达后的取消不触发自动限制，需通过技师举报系统人工处理
  - **临时限制过期**：`place_order` RPC 自动检查并清除过期限制
- **信用分系统**（0-100分，初始80分）：
  - 60分以下禁止下单
  - 完成订单自动+2分（最高100分）
  - 触发B自动-12分（最低0分）
  - 技师评价会影响信用分（现有逻辑）

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

## CBODY Private 扩展数据结构

> **文档新增时间：2026-08-05**
>
> 本章节描述 CBODY Private Incall 高级展示站的独立扩展。所有对象均为新增 `private_*` 表、Private 辅助函数或公开只读 RPC；不向原 CBODY 表增加字段、索引或触发器，也不修改原表数据。

### Private 技师标识约定

以下三个字段用途不同，任何客户端、网站或 ops 实现不得混用：

| 用途 | 来源字段 | 示例 | 说明 |
|------|----------|------|------|
| 数据库内部关联键 | `girls.id` | UUID | 所有 `private_*` 外键统一关联此字段，不在页面作为工号展示 |
| 页面展示工号 | `girls.girl_number` | `1177` / `No. 1177` | CBODY 分配给技师的公开工号；网站中的 `No. 1177` 必须来自此字段 |
| 稳定 URL slug | `girls.username` | `diana` | 唯一用户名，用于 `/ladies/diana`；不得使用可重复、可修改的 `girls.name` 作为稳定 slug |
| 页面显示姓名 | `girls.name` | `Diana` | 公开昵称，可以与其他技师重复，不作为数据库关联键 |

示例：页面显示 `No. 1177 · Diana` 时，`1177` 来自 `girls.girl_number`，`Diana` 来自 `girls.name`，而 Private 扩展记录实际通过 `girls.id` UUID 关联。

### Private 多语言约定

- Private 新增多语言 JSONB 默认使用英文键，例如 `{"en":""}`。
- 多语言数组使用 `{"en":[]}`。
- 公开读取顺序固定为：请求语言 → `en` → 空字符串或空数组。
- 当前网站以英文为主，但结构允许后续加入 `zh`、`th`、`ja`、`ko`。
- 原表已有多语言字段继续复用，不复制到 Private 表；只有 Private 专属或需要覆盖的内容才写入扩展表。

---

### private_profiles（Private 技师展示扩展表）

每名进入 CBODY Private 的技师最多一条记录。技师基础资料仍来自 `girls`，本表只保存 Private 专属展示与发布信息。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| girl_id | UUID | 是 | - | 主键，关联 `girls.id`；这是内部 UUID，不是展示工号 |
| introduction | JSONB | 是 | `{"en":""}` | Private 卡片短介绍，多语言 |
| bio | JSONB | 是 | `{"en":""}` | Private 详情页介绍，多语言 |
| personal_tags | JSONB | 是 | `{"en":[]}` | Private 个性标签，多语言数组 |
| skin_tone | JSONB | 是 | `{"en":""}` | Private 展示肤色，多语言 |
| body_type | JSONB | 是 | `{"en":""}` | Private 展示体型，多语言 |
| display_age | SMALLINT | 否 | NULL | Private 手动维护的公开年龄；NULL 时页面隐藏年龄 |
| badge | TEXT | 否 | NULL | Private 列表标签：hot/new/signature/vip |
| sort_order | INTEGER | 是 | 999 | Private 技师排序，数值越小越靠前 |
| is_published | BOOLEAN | 是 | false | 是否在 Private 网站公开发布 |
| health_certified | BOOLEAN | 是 | false | Private 独立确认的健康认证展示状态；不等同于 `girls.is_verified` |
| booking_url | TEXT | 是 | `''` | 跳转现有 CBODY 预约平台的 HTTPS 地址 |
| created_by | UUID | 否 | NULL | 创建管理员，关联 `auth.users(id)` |
| updated_by | UUID | 否 | NULL | 最后修改管理员，关联 `auth.users(id)` |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`girl_id`)
- INDEX `private_profiles_published_sort_idx` (`sort_order`, `girl_id`) WHERE `is_published = true`

**外键约束**：
- FOREIGN KEY (`girl_id`) REFERENCES `girls(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- CHECK (`badge` IS NULL OR `badge` IN ('hot', 'new', 'signature', 'vip'))
- CHECK (`display_age` IS NULL OR `display_age` BETWEEN 20 AND 99)
- CHECK (`sort_order >= 0`)
- CHECK (`booking_url = ''` OR `booking_url` 为 HTTPS URL)

**说明**：
- 页面工号始终读取 `girls.girl_number`，本表不重复保存工号。
- URL slug 始终读取 `girls.username`，本表不重复保存 slug。
- Private 页面年龄只读取 `display_age`，不再根据 `girls.birth_date` 自动计算公开年龄。
- `health_certified` 只能在 Private 确认过真实认证依据后开启，不得直接映射 `girls.is_verified`。

---

### private_availability_settings（Private 常规排班设置表）

每名 Incall 技师一条持续生效的常规排班。管理员只需设置固定工作时间，并按实际情况开启或关闭可约状态；未再次修改时，状态和时间每天继续生效。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| girl_id | UUID | 是 | - | 主键，关联 `girls.id` |
| is_available | BOOLEAN | 是 | false | 当前是否可约；保持到管理员下次修改 |
| start_time | TIME | 是 | `15:00` | 每天固定开始时间 |
| end_time | TIME | 是 | `02:00` | 每天固定结束时间 |
| ends_next_day | BOOLEAN | 是 | true | 结束时间是否属于次日 |
| note | JSONB | 是 | `{"en":""}` | 可选的多语言常规排班说明 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`girl_id`)
- INDEX `private_availability_settings_available_idx` (`girl_id`) WHERE `is_available = true`

**外键约束**：
- FOREIGN KEY (`girl_id`) REFERENCES `girls(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- `start_time <> end_time`
- `jsonb_typeof(note) = 'object'`

**说明**：
- `15:00–02:00` 保存为 `start_time=15:00`、`end_time=02:00`、`ends_next_day=true`。
- 关闭 `is_available` 不清除工作时间；下次开启时直接恢复原固定时段。
- migration 从每名技师最新的 `private_availability` 记录初始化本表，不覆盖已存在的常规设置。
- 公开 RPC 应优先读取本表；跨午夜时在次日结束时间前继续视为上一工作时段。

---

### private_availability（Private 历史按日排班表）

原按曼谷日期保存的排班表继续保留历史数据和未来单日例外扩展能力；当前 ops 日常排班不再要求管理员每天维护本表。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | `gen_random_uuid()` | 主键 |
| girl_id | UUID | 是 | - | 关联 `girls.id` |
| service_date | DATE | 是 | - | 排班所属曼谷日期 |
| is_available | BOOLEAN | 是 | false | 当日是否可约 |
| start_time | TIME | 否 | NULL | 当日开始时间 |
| end_time | TIME | 否 | NULL | 结束时间 |
| ends_next_day | BOOLEAN | 是 | false | 结束时间是否属于次日，例如 15:00–02:00 |
| note | JSONB | 是 | `{"en":""}` | 可选的多语言排班说明 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`id`)
- UNIQUE (`girl_id`, `service_date`)
- INDEX `private_availability_date_idx` (`service_date`, `is_available`, `girl_id`)

**外键约束**：
- FOREIGN KEY (`girl_id`) REFERENCES `girls(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- `start_time` 与 `end_time` 必须同时为空或同时有值
- `ends_next_day = true` 时开始和结束时间不得为空

**说明**：
- 当前常规状态和固定工作时间读取 `private_availability_settings`；本表不再作为 ops 默认录入入口。
- `15:00–02:00` 应保存为 `start_time=15:00`、`end_time=02:00`、`ends_next_day=true`。
- 若未来启用单日例外，公开 RPC 可让本表的目标日期记录覆盖常规设置。
- 不复用 `girls_status`，因为该表表示原 Outcall 平台实时上下线状态，与 Private 当日排班语义不同。

---

### private_media（Private 技师媒体表）

保存 Private 专属封面、相册图片和视频外链。原 `girls_media` 不修改，也不会被本表覆盖。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | `gen_random_uuid()` | 主键 |
| girl_id | UUID | 是 | - | 关联 `girls.id` |
| kind | TEXT | 是 | - | 媒体类型：image/video |
| role | TEXT | 是 | gallery | 用途：cover/gallery |
| url | TEXT | 是 | - | 图片或视频 HTTPS URL，可使用 Supabase Storage 或 R2 |
| poster_url | TEXT | 否 | NULL | 视频封面 HTTPS URL；视频记录必须提供 |
| mime_type | TEXT | 否 | NULL | 视频或媒体 MIME，例如 `video/mp4`、`video/webm` |
| alt | JSONB | 是 | `{"en":""}` | 多语言替代文本 |
| sort_order | INTEGER | 是 | 0 | 同一技师媒体排序 |
| is_active | BOOLEAN | 是 | true | 是否启用 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`id`)
- UNIQUE INDEX `private_media_one_active_cover_idx` (`girl_id`) WHERE `role='cover' AND is_active=true`
- INDEX `private_media_gallery_sort_idx` (`girl_id`, `role`, `sort_order`, `id`) WHERE `is_active=true`

**外键约束**：
- FOREIGN KEY (`girl_id`) REFERENCES `girls(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- CHECK (`kind` IN ('image', 'video'))
- CHECK (`role` IN ('cover', 'gallery'))
- CHECK (`sort_order >= 0`)
- `url` 与 `poster_url` 必须为 HTTPS URL
- `kind='video'` 时 `poster_url` 必填

**说明**：
- 每名技师最多一张启用状态的 cover。
- 图片记录的 `url` 是图片地址；视频记录的 `url` 是视频地址，`poster_url` 是预览图。
- 数据库中的 `/images/...`、`cbodyprivate.com/images/...` 与 `cbody.vip/images/...` 图片会统一规范化为 `https://cbody.vip/images/...`；本地、预览和正式域名使用同一媒体来源。
- Supabase Storage、R2 等其他 HTTPS 资源保持原 URL，不会被重写。
- 前端依据 `mime_type` 生成 video source，并支持 MP4、WebM、OGG、MOV 等浏览器可识别格式；最终播放能力仍取决于浏览器编解码器。

---

### private_album_settings（Private 混合相册设置表）

每名 Private 技师最多一条相册设置记录。媒体项目仍保存在 `private_media`，本表只保存整个混合相册共用的背景音乐和静态照片轮播参数。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| girl_id | UUID | 是 | - | 主键，关联 `girls.id` |
| background_audio_url | TEXT | 否 | NULL | 背景音乐 HTTPS URL |
| background_audio_object_key | TEXT | 否 | NULL | R2 对象路径，供后台替换或删除文件 |
| background_audio_mime_type | TEXT | 否 | NULL | 音频 MIME，例如 `audio/mp4`、`audio/mpeg` |
| background_audio_title | TEXT | 否 | NULL | 后台识别用音乐名称 |
| background_volume | NUMERIC(3,2) | 是 | 0.35 | 默认音量，范围 0–1 |
| background_loop | BOOLEAN | 是 | true | 是否循环播放 |
| is_audio_enabled | BOOLEAN | 是 | false | 是否启用背景音乐 |
| slide_duration_seconds | SMALLINT | 是 | 5 | 静态照片默认停留秒数，范围 3–10 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`girl_id`)
- INDEX `private_album_settings_enabled_idx` (`girl_id`) WHERE `is_audio_enabled=true`

**外键约束**：
- FOREIGN KEY (`girl_id`) REFERENCES `girls(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- CHECK (`background_audio_url` IS NULL OR `background_audio_url` 为 HTTPS URL)
- CHECK (`background_volume` BETWEEN 0 AND 1)
- CHECK (`slide_duration_seconds` BETWEEN 3 AND 10)
- CHECK (`is_audio_enabled=false` OR `background_audio_url` IS NOT NULL)

**说明**：
- “动态照片”仍保存为 `private_media.kind='video'`，不新增 `live_photo` 类型。
- 背景音乐属于整个技师相册，不复制到每条媒体记录。
- 当前 ops 只维护已经上传完成的 HTTPS URL；真实文件建议保存在 R2。
- `background_audio_object_key` 仅供后台管理文件生命周期，不应通过公开 RPC 返回。

---

### private_service_settings（Private 服务目录扩展表）

在不修改原 `services` 表的前提下，标记原服务是否用于 Private Incall，以及是否允许展示 Themed Attire。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| service_id | INTEGER | 是 | - | 主键，关联原 `services.id` |
| is_incall_enabled | BOOLEAN | 是 | false | 该原服务是否允许用于 CBODY Private Incall |
| supports_attire | BOOLEAN | 是 | false | 该服务是否允许绑定和展示制服 |
| display_category | TEXT | 是 | wellness | Private 前端分类：wellness/yoga/screening |
| name_override | JSONB | 是 | `{"en":""}` | 兼容保留字段；当前公开 RPC 始终使用原 `services.title` |
| description_override | JSONB | 是 | `{"en":""}` | Private 通用服务介绍；不会回退原 `services.description` |
| sort_order | INTEGER | 是 | 999 | Private 服务目录默认排序 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`service_id`)
- INDEX `private_service_settings_active_sort_idx` (`sort_order`, `service_id`) WHERE `is_incall_enabled=true`

**外键约束**：
- FOREIGN KEY (`service_id`) REFERENCES `services(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- CHECK (`display_category` IN ('wellness', 'yoga', 'screening'))
- CHECK (`sort_order >= 0`)

**说明**：
- 这里的外键由新表持有，不向原 `services` 表增加任何字段。
- `supports_attire=false` 时，即使残留制服绑定记录，公开 RPC 也不会返回制服。
- 服务标题始终读取原 `services.title`；原 `services.description` 不用于 Private 页面。
- `description_override` 是 Private 通用介绍；某位技师需要专属版本时，由 `private_provider_services.description_override` 优先覆盖。

---

### private_provider_services（Private 技师服务展示表）

关联已经由管理员审核的 `admin_girl_services` 记录，决定某名技师的某项合格服务是否在 Private 网站发布。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| admin_girl_service_id | UUID | 是 | - | 主键，关联 `admin_girl_services.id` |
| is_published | BOOLEAN | 是 | false | 是否在该技师 Private 页面展示 |
| sort_order | INTEGER | 是 | 999 | 该技师服务排序 |
| badge | TEXT | 否 | NULL | 兼容保留字段；当前公开推荐标签读取原 `services.badge` 并映射为 Private 展示标签 |
| description_override | JSONB | 是 | `{"en":""}` | 此技师对应服务的专属介绍覆盖 |
| includes_override | JSONB | 是 | `{"en":[]}` | 此技师对应服务的包含内容，多语言数组 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`admin_girl_service_id`)
- INDEX `private_provider_services_published_sort_idx` (`sort_order`, `admin_girl_service_id`) WHERE `is_published=true`

**外键约束**：
- FOREIGN KEY (`admin_girl_service_id`) REFERENCES `admin_girl_services(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- CHECK (`badge` IS NULL OR `badge` IN ('popular', 'trending', 'new', 'signature', 'recommended'))
- CHECK (`sort_order >= 0`)

**Private 服务公开条件**：

一个服务只有同时满足以下条件才会出现在网站：

1. `services.is_active = true`；
2. `private_service_settings.is_incall_enabled = true`；
3. `admin_girl_services.is_qualified = true`；
4. `private_provider_services.is_published = true`；
5. 至少存在一条 `girl_service_durations.is_active = true`；
6. 对应 `service_durations.is_active = true`。

**公开字段来源**：

- 名称：`services.title`；
- 推荐标签：`services.badge`，公开 RPC 将 `TOP_PICK` 映射为 `recommended`、`HOT` 映射为 `popular`；
- 时长与价格：只返回最短的一条有效时长，价格为 `COALESCE(girl_service_durations.custom_price, service_durations.default_price)`；
- 介绍：`private_provider_services.description_override`，为空时读取 `private_service_settings.description_override`，不回退原服务介绍；
- 子项目：`private_provider_services.includes_override`；
- 制服：`private_provider_service_attires → private_attires`，并受 `private_service_settings.supports_attire` 控制。

---

### private_attires（Private 制服目录表）

Private 专属 Themed Attire 公共目录，可被多名技师的不同服务复用。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | `gen_random_uuid()` | 主键 |
| code | TEXT | 是 | - | 唯一制服编号，例如 A001 |
| name | JSONB | 是 | `{"en":""}` | 多语言制服名称 |
| note | JSONB | 是 | `{"en":""}` | 多语言简短说明 |
| image_url | TEXT | 是 | - | 制服 HTTPS 图片地址 |
| sort_order | INTEGER | 是 | 999 | 默认排序 |
| is_active | BOOLEAN | 是 | true | 是否启用 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`id`)
- UNIQUE (`code`)
- INDEX `private_attires_active_sort_idx` (`sort_order`, `code`) WHERE `is_active=true`

**外键约束**：
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**CHECK约束**：
- `code` 不得为空
- `image_url` 必须为 HTTPS URL
- CHECK (`sort_order >= 0`)

---

### private_provider_service_attires（Private 技师服务制服关联表）

制服不是直接绑定技师，也不是仅绑定全局服务，而是绑定“技师已审核服务关系”。这样同一项服务在不同技师处可以拥有不同制服集合。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| admin_girl_service_id | UUID | 是 | - | 关联 `admin_girl_services.id` |
| attire_id | UUID | 是 | - | 关联 `private_attires.id` |
| sort_order | INTEGER | 是 | 999 | 该技师该服务中的制服排序 |
| is_active | BOOLEAN | 是 | true | 是否启用此绑定 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`admin_girl_service_id`, `attire_id`)
- INDEX `private_provider_service_attires_active_sort_idx` (`admin_girl_service_id`, `sort_order`, `attire_id`) WHERE `is_active=true`

**外键约束**：
- FOREIGN KEY (`admin_girl_service_id`) REFERENCES `admin_girl_services(id)` ON DELETE CASCADE
- FOREIGN KEY (`attire_id`) REFERENCES `private_attires(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**绑定校验**：
- 绑定写入前，由仅挂载在本新表上的校验触发器确认对应 `services.id` 已存在 `private_service_settings`。
- `is_incall_enabled` 与 `supports_attire` 必须同时为 true。
- 原 `admin_girl_services` 表不会增加触发器或字段。

---

### private_location_content（Private 场所公开文案扩展表）

场所身份、照片、城市和 Google Place 继续复用 `incall_locations`；本表只保存适合公开且可本地化的名称与地区。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| incall_location_id | UUID | 是 | - | 主键，关联 `incall_locations.id` |
| public_name | JSONB | 是 | `{"en":""}` | 对外公开的场所名称，不得包含房号或敏感信息 |
| district | JSONB | 是 | `{"en":""}` | 对外地区，例如 Thonglor |
| is_published | BOOLEAN | 是 | false | 是否允许在 Private 网站公开 |
| created_by | UUID | 否 | NULL | 创建管理员 |
| updated_by | UUID | 否 | NULL | 最后修改管理员 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (`incall_location_id`)
- INDEX `private_location_content_published_idx` (`incall_location_id`) WHERE `is_published=true`

**外键约束**：
- FOREIGN KEY (`incall_location_id`) REFERENCES `incall_locations(id)` ON DELETE CASCADE
- FOREIGN KEY (`created_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL
- FOREIGN KEY (`updated_by`) REFERENCES `auth.users(id)` ON DELETE SET NULL

**公开场所数据来源**：
- 场所 UUID：`incall_locations.id`
- 场所名称：`incall_locations.name`；若名称包含 Room、Unit、Floor 或 Suite 等敏感房间信息，公开 RPC 回退到 `private_location_content.public_name`
- 公共地区：`private_location_content.district`，例如 Rama 9；该扩展字段已经存在，无需再新增表或字段
- 图片：`incall_locations.photos`
- 城市：`incall_locations.city_id → cities.name`
- Google Maps：根据 `incall_locations.place_id` 构造标准 Maps URL；缺少 Place ID 时不展示无效链接

**禁止公开**：
- `incall_locations.address`
- `incall_locations.lat` / `lng`
- 房号、楼层、门禁说明
- 未经筛选的 `incall_locations.meta`

---

### Private 公开只读 RPC

#### get_private_providers(locale TEXT DEFAULT 'en')

返回已通过全部发布、Incall、认证、服务和场所条件的技师列表。返回内容包括：

- `id`：字符串形式的 `girls.girl_number`，用于页面工号语义；
- `girlId`：内部 `girls.id` UUID；
- `code`：格式化后的 `№ 1177`；
- `slug`：`girls.username`；
- 显示姓名、Private 文案、标签和基础资料；
- 当日排班；
- cover、gallery 图片和视频；
- 通过 `girls_categories → categories` 读取的技师分类（`id`、`code`、本地化 `name`、`sortOrder`）；
- 场所公开信息；
- 已审核、已启用的服务时长、价格与制服。

#### get_private_provider(slug TEXT, locale TEXT DEFAULT 'en')

按照 `girls.username` 查询单个技师并返回相同的公开安全结构。无符合条件记录时返回 NULL。

#### get_private_categories(locale TEXT DEFAULT 'en')

返回 `categories.is_active=true` 的分类列表，名称读取规则为“请求语言 → 英文 → 空字符串”，供列表页动态生成分类筛选。该 RPC 不修改或复制原分类数据。

**安全边界**：
- 网站使用 Supabase anon key 调用 RPC。
- anon 不直接读取 `girls`、`incall_locations` 或任何 `private_*` 原始表。
- RPC 不返回精确地址、坐标、内部备注、管理员字段、财务字段或认证资料原件。
- 网站不得使用 service role key。

---

### Private RLS 与管理权限

所有新增 `private_*` 表启用 RLS：

| 管理员角色 | 权限 |
|------------|------|
| superadmin | Private 扩展表完整读写 |
| admin | Private 扩展表完整读写 |
| support | 读取 Private 扩展数据；新增和修改 `private_availability`；不可删除排班 |
| finance | 无 Private 内容写权限 |
| anon | 不可直接读取扩展表，只能执行三个公开只读 RPC |

所有更新通过新增表自己的 `updated_at` 触发器记录修改时间和 `updated_by`。这些触发器不会挂载到原 CBODY 表。

---

### Private 动态数据绑定流程

推荐执行顺序：

1. 审核网站仓库中的 Private migration，确认与当前线上表字段一致。
2. 使用正常 Supabase migration 流程应用新增对象；不要在原表中手工增加 Private 字段。
3. 在 `private_service_settings` 中选择真实 `services.id`，开启允许用于 Incall 的服务并设置 `supports_attire`。
4. 在 `private_location_content` 中为已有 `incall_locations.id` 补充安全的公开名称和地区。
5. 在 `private_profiles` 中通过真实 `girls.id` 创建 Private 资料；确认该技师已通过原有 `girls_categories` 绑定有效的 `categories.id`。后台列表同时显示 `girls.girl_number` 和 `girls.name` 方便运营识别。
6. 在 `private_media` 中添加一张 cover 和需要的 gallery 图片/视频。
7. 从已审核的 `admin_girl_services.id` 创建 `private_provider_services`，不得直接绕过审核关系绑定 `services.id`。
8. 价格和时长继续读取 `girl_service_durations` 与 `service_durations`，Private 表不复制价格。
9. 如果服务支持制服，先维护 `private_attires`，再写入 `private_provider_service_attires`。
10. 在 `private_availability_settings` 设置固定工作时间，并按实际情况持续开启或关闭可约状态。
11. 使用 anon 角色分别测试 `get_private_categories('en')`、`get_private_providers('en')` 和 `get_private_provider(slug, 'en')`。
12. 数据完整后，在 Vercel 设置 `PRIVATE_DATA_SOURCE=supabase`、`SUPABASE_URL` 和 `SUPABASE_ANON_KEY`，重新部署一次完成切换。此后日常资料更新不需要 Git 提交或 Vercel 重新部署。

### ops 后台建议

数据库 migration 和 RPC 可以先完成并使用 Supabase Studio 验证，不需要等待 ops 页面才能测试。但是在正式将生产网站切换为动态数据前，建议在现有 ops 增加一个轻量 `CBODY Private` 模块，避免多人直接编辑数据库。

建议最少提供以下界面：

1. **Private 技师列表**：工号 `girl_number`、姓名、发布状态、当前可约、固定工作时间、标签和排序。
2. **Private Profile**：介绍、标签、体型展示、健康认证状态和预约 URL。
3. **混合相册**：每名技师维护 1–5 项静态图片或动态照片；动态照片按无声短视频保存并配置 poster，背景音乐与轮播参数读取 `private_album_settings`。
4. **Services**：只显示已经存在于 `admin_girl_services` 且 `is_qualified=true` 的服务；管理 Private 发布状态、介绍和排序。
5. **Themed Attire**：维护制服目录，并绑定到指定的已审核技师服务。
6. **Venue**：从现有 `incall_locations` 选择场所，只维护 Private 公开名称、地区与发布状态。
7. **Availability**：维护持续生效的可约开关和每日固定工作时间，支持跨午夜及批量设置。

ops 不需要新建独立后端、订单系统或 CMS，只需复用现有 Supabase、管理员登录和 `admin_profiles` 权限。

---

### 原 CBODY 表变更确认

截至 **2026-08-05**，CBODY Private 扩展方案对原表的处理如下：

- `girls`：**未增加字段，未修改索引，未增加触发器，未修改数据**。
- `girls_status`：**未修改，也不用于 Private 排班**。
- `services`：**未增加 Incall 或制服字段**；相关配置位于 `private_service_settings`。
- `service_durations`：**未修改**，继续作为服务时长和默认价格来源。
- `admin_girl_services`：**未修改**，Private 只通过新表外键读取已审核关系。
- `girl_service_durations`：**未修改**，继续作为技师启用时长和自定义价格来源。
- `incall_locations`：**未增加字段，未修改数据**；Private 通过 `private_location_content` 补充公开文案。
- `girls_media`：**未修改**；Private 专属媒体保存在 `private_media`。
- `orders`、支付、结算、聊天及其他 Outcall 业务表：**全部未修改**。

新增表中的外键指向原表，只建立 Private 扩展记录到原数据的引用；不会改变原 Outcall 客户端、技师端或 ops 当前读取和写入原表的方式。

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
| service_type | TEXT | 是 | 'outcall' | 服务类型：outcall（上门）/ incall（到店） |
| incall_requested_at | TIMESTAMPTZ | 否 | NULL | 顾客意向预约时间（incall 专用，15 分钟为单位） |
| incall_location_snapshot | JSONB | 否 | NULL | 到店地址快照（含 location_id/name/address/lat/lng/photos） |
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
- INDEX idx_orders_service_type (service_type)
- INDEX idx_orders_incall_requested (incall_requested_at) WHERE incall_requested_at IS NOT NULL

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
- CHECK (service_type IN ('outcall', 'incall'))
- CHECK (service_type != 'incall' OR travel_fee = 0)
- CHECK (service_type != 'outcall' OR incall_requested_at IS NULL)

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

## order_time_extensions（订单加钟记录表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_id | UUID | 是 | - | 订单ID，关联orders表 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| package_id | UUID | 是 | - | 加钟套餐ID，关联add_time_packages表 |
| duration_minutes | INTEGER | 是 | - | 本次加钟分钟数 |
| commission_thb_snapshot | DECIMAL(10,2) | 是 | - | 报备当时的加钟佣金快照（THB） |
| reported_at | TIMESTAMPTZ | 是 | NOW() | 报备时间 |
| base_service_duration_before | INTEGER | 是 | - | 加钟前原始服务时长（分钟） |
| service_duration_after | INTEGER | 是 | - | 加钟后服务时长（分钟） |
| settlement_status | TEXT | 是 | 'reported' | 结算状态：reported/settled/rejected |
| reviewed_at | TIMESTAMPTZ | 否 | NULL | 审核时间 |
| reviewed_by | UUID | 否 | NULL | 审核人ID，关联auth.users表 |
| notes | TEXT | 否 | NULL | 备注说明 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_order_time_ext_order (order_id, reported_at DESC)
- INDEX idx_order_time_ext_girl_status (girl_id, settlement_status, reported_at DESC)
- INDEX idx_order_time_ext_reported (reported_at DESC) WHERE settlement_status = 'reported'

**外键约束**：
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE RESTRICT
- FOREIGN KEY (package_id) REFERENCES add_time_packages(id) ON DELETE RESTRICT
- FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (duration_minutes IN (30, 60, 120, 360))
- CHECK (commission_thb_snapshot >= 0)
- CHECK (settlement_status IN ('reported', 'settled', 'rejected'))
- CHECK (service_duration_after = base_service_duration_before + duration_minutes)

**说明**：
- 记录每一笔加钟报备，支持一个订单多次加钟
- `commission_thb_snapshot` 为报备时的固定平台佣金快照，避免后续套餐价格变更影响历史记录
- `base_service_duration_before` 与 `service_duration_after` 用于还原每次加钟前后时长变化
- `settlement_status` 用于后续结算归档：默认 `reported`，审核通过后可标记为 `settled`，驳回则为 `rejected`

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
| rating_overall | DECIMAL(3,2) | 是 | 0 | 三项平均总分（不含相似度，触发器会自动计算,以实现） |
| comment_text | TEXT | 否 | NULL | 用户评价文字 |
| is_anonymous | BOOLEAN | 否 | false | 是否匿名评论（true=匿名显示，false=显示真实用户名） |
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
- INDEX idx_order_reviews_anonymous (is_anonymous) WHERE is_anonymous = true

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
| deposit_amount | DECIMAL(10,2) | 是 | 0 | 技师已付定金总额（THB），同时作为欠款阈值 |
| balance | DECIMAL(10,2) | 是 | 0 | 技师当前可用欠款（THB），可发起新结账申请的金额 |
| frozen_balance_thb | DECIMAL(10,2) | 是 | 0 | 冻结的THB欠款（结账申请处理中） |
| platform_collected_rmb_balance | DECIMAL(10,2) | 是 | 0 | 平台代收可提现余额（RMB），可发起新提现申请的金额 |
| frozen_rmb_balance | DECIMAL(10,2) | 是 | 0 | 冻结的RMB代收（提现申请处理中） |
| currency | VARCHAR(3) | 是 | 'THB' | 主币种（用于 balance 和 deposit_amount） |
| bank_account_name | TEXT | 否 | NULL | 收款人姓名（开户名），用于提现打款 |
| bank_account_number | TEXT | 否 | NULL | 银行账号 |
| bank_name | TEXT | 否 | NULL | 银行名称 |
| bank_branch | TEXT | 否 | NULL | 支行信息（可选） |
| bank_meta | JSONB | 否 | '{}' | 预留扩展字段（SWIFT/BIC、备注等） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_girl_settlement_girl_id (girl_id)
- INDEX idx_girl_settlement_balance (balance) WHERE balance > 0
- INDEX idx_girl_settlement_rmb_balance (platform_collected_rmb_balance) WHERE platform_collected_rmb_balance > 0
- INDEX idx_girl_settlement_frozen_thb (frozen_balance_thb) WHERE frozen_balance_thb > 0
- INDEX idx_girl_settlement_frozen_rmb (frozen_rmb_balance) WHERE frozen_rmb_balance > 0

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE

**CHECK约束**：
- CHECK (deposit_amount >= 0)
- CHECK (balance >= 0)
- CHECK (frozen_balance_thb >= 0)
- CHECK (platform_collected_rmb_balance >= 0)
- CHECK (frozen_rmb_balance >= 0)

**说明**：
- 每个技师一条记录，订单完成时自动更新
- **冻结金额机制**（防止重复申请）：
  - 技师提交结账/提现申请时，金额立即从可用余额转移到冻结余额
  - 管理员确认时，从冻结余额中扣除
  - 管理员取消时，从冻结余额退回到可用余额
  - 可用余额始终准确，防止重复申请
- **`balance`（可用欠款，THB）**：
  - 仅用于记录「订单抽成」导致的技师欠费（未冻结部分）
  - 订单完成时，平台应得抽成累加到此字段
  - 技师提交结账申请时，立即转移到 `frozen_balance_thb`
  - 可发起新结账申请的金额 = `balance`
- **`frozen_balance_thb`（冻结欠款，THB）**：
  - 结账申请处理中的金额
  - 管理员确认后扣除，取消后退回 `balance`
- **总欠款** = `balance` + `frozen_balance_thb`
- **`platform_collected_rmb_balance`（可提现代收，RMB）**：
  - 仅用于记录「平台收款码代收」的金额（未冻结部分）
  - 由订单维度的 `customer_paid_to_platform` 累加
  - 技师提交提现申请时，立即转移到 `frozen_rmb_balance`
  - 可发起新提现申请的金额 = `platform_collected_rmb_balance`
- **`frozen_rmb_balance`（冻结代收，RMB）**：
  - 提现申请处理中的金额
  - 管理员确认后扣除，取消后退回 `platform_collected_rmb_balance`
- **总代收** = `platform_collected_rmb_balance` + `frozen_rmb_balance`
- **`deposit_amount`（定金总额，THB）**：
  - 既记录技师实际已付定金，也作为欠款阈值
  - 技师付多少定金就能欠多少
- **上线规则**（使用总欠款）：
  - 当总欠款 >= `deposit_amount * 0.8` 时，给技师预警
  - 当总欠款 > `deposit_amount` 时，禁止技师继续上线接单
  - 总欠款 = `balance` + `frozen_balance_thb`
- **提现规则**（使用可用余额）：
  - 当 `platform_collected_rmb_balance` >= `app_configs.settlement.min_withdrawal_amount_rmb` 时技师才可发起提现申请
  - 提现金额 ≤ `platform_collected_rmb_balance`（可用余额，不含冻结）

---

## order_settlements（订单核验明细表）

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_id | UUID | 是 | - | 订单ID，关联orders表（唯一） |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| service_fee | DECIMAL(10,2) | 是 | - | 服务费快照 |
| extra_fee | DECIMAL(10,2) | 是 | 0 | 额外费用快照 |
| service_commission_rate | DECIMAL(5,4) | 是 | - | 服务提成比例快照（0.4=40%） |
| extra_commission_rate | DECIMAL(5,4) | 是 | - | 额外费用提成比例快照（0.2=20%） |
| platform_should_get | DECIMAL(10,2) | 是 | - | 平台应得抽成（THB）=service_fee×service_rate+extra_fee×extra_rate |
| add_time_count | INTEGER | 是 | 0 | 加钟次数汇总 |
| add_time_duration_minutes | INTEGER | 是 | 0 | 加钟时长汇总（分钟） |
| add_time_commission_thb | DECIMAL(10,2) | 是 | 0 | 加钟固定佣金汇总（THB） |
| customer_paid_to_platform | DECIMAL(10,2) | 是 | 0 | 顾客以 THB 直接支付到平台账户的金额（如泰铢银行转账、信用卡） |
| actual_paid_amount | DECIMAL(10,2) | 否 | NULL | 平台收款码代收的原币种金额（通常为人民币） |
| settlement_amount | DECIMAL(10,2) | 是 | - | 净差额（THB）=platform_should_get-customer_paid_to_platform，仅用于展示 |
| payment_content_type | TEXT | 否 | NULL | 支付内容类型（NULL=技师自己收款）：deposit/full_amount/tip/other |
| payment_method | TEXT | 否 | NULL | 支付方式：wechat/alipay/thb_bank_transfer/credit_card/cash/other |
| payment_notes | TEXT | 否 | NULL | 支付备注说明 |
| settlement_status | TEXT | 是 | 'pending' | 状态：pending（待核验）/settled（已核验通过）/rejected（已拒绝） |
| settled_at | TIMESTAMPTZ | 否 | NULL | 核验通过时间 |
| rejected_at | TIMESTAMPTZ | 否 | NULL | 拒绝时间 |
| reject_reason | TEXT | 否 | NULL | 拒绝原因说明 |
| notes | TEXT | 否 | NULL | 管理员备注 |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- UNIQUE INDEX idx_order_settlement_order_id (order_id)
- INDEX idx_order_settlement_girl_id (girl_id)
- INDEX idx_order_settlement_status (settlement_status)
- INDEX idx_order_settlement_pending (girl_id, created_at DESC) WHERE settlement_status = 'pending'
- INDEX idx_order_settlement_rejected (girl_id, rejected_at DESC) WHERE settlement_status = 'rejected'
- INDEX idx_order_settlement_payment_content (payment_content_type) WHERE payment_content_type IS NOT NULL
- INDEX idx_order_settlement_payment_method (payment_method) WHERE payment_method IS NOT NULL

**外键约束**：
- FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE RESTRICT

**CHECK约束**：
- CHECK (settlement_status IN ('pending', 'settled', 'rejected'))
- CHECK (payment_content_type IS NULL OR payment_content_type IN ('deposit', 'full_amount', 'tip', 'other'))
- CHECK (payment_method IS NULL OR payment_method IN ('wechat', 'alipay', 'thb_bank_transfer', 'credit_card', 'cash', 'other'))
- CHECK (service_commission_rate >= 0 AND service_commission_rate <= 1)
- CHECK (extra_commission_rate >= 0 AND extra_commission_rate <= 1)
- CHECK (service_fee >= 0 AND extra_fee >= 0)
- CHECK (platform_should_get >= 0 AND customer_paid_to_platform >= 0)
- CHECK (add_time_count >= 0)
- CHECK (add_time_duration_minutes >= 0)
- CHECK (add_time_commission_thb >= 0)

**说明**：
- 订单完成时自动创建记录并计算
- 订单取消时，如有平台代收款则自动创建（status='pending'），供管理员核验
- **字段语义**：
  - `platform_should_get`（THB）：平台应得抽成，核验通过时累加到 `girl_settlement_accounts.balance`
  - `add_time_count` / `add_time_duration_minutes` / `add_time_commission_thb`：订单加钟汇总信息，用于展示和结算归档
  - `customer_paid_to_platform`（THB）：顾客以泰铢直接支付到平台账户的金额
  - `actual_paid_amount`（RMB）：平台收款码代收的原币种金额，核验通过时累加到 `girl_settlement_accounts.platform_collected_rmb_balance`
  - `settlement_amount`（THB）：净差额，仅用于展示，不直接用于更新账户余额
- **状态说明**：
  - `pending`：待管理员核验（默认状态）
  - `settled`：核验通过，钱归技师，触发余额更新
  - `rejected`：核验拒绝，需要退款给客户或技师退回
- **核验逻辑**（`settlement_status` 从 `pending` → `settled` 时）：
  - 订单抽成记账：将 `platform_should_get`（包含加钟固定佣金汇总）累加到 `girl_settlement_accounts.balance`（THB 欠款）
  - 平台代收记账：若 `payment_method` in ('wechat','alipay') 且 `actual_paid_amount > 0`，将 `actual_paid_amount` 累加到 `girl_settlement_accounts.platform_collected_rmb_balance`（RMB）
- **拒绝逻辑**（`settlement_status` 从 `pending` → `rejected` 时）：
  - 不更新账户余额
  - 管理员需填写 `reject_reason` 说明拒绝原因
  - `rejected_at` 记录拒绝时间
  - 技师或管理员需根据情况退款给客户
- **平台收款信息录入规则**：
  - 必须从订单详情页录入（`actual_paid_amount` + `payment_method` + 截图等）
  - 仅在订单处于 `pending/confirmed/in_service` 状态时开放入口
  - 订单 `completed` 后仅允许在有限时间窗口内（如 30 分钟）补录或修改
  - 避免在结算管理页出现无订单号的平台收款记录

## settlement_transactions（结账/提现申请表）

**唯一记录"真实资金流动"的申请与确认**：要么技师给平台结账，要么平台向技师打款提现。订单层面的应收应付由 `order_settlements` 负责，本表不再关联具体订单。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| girl_id | UUID | 是 | - | 技师ID，关联girls表 |
| transaction_type | TEXT | 是 | - | 交易类型：settlement（技师结账给平台）/ withdrawal（技师提现） |
| direction | TEXT | 是 | - | 资金流向：to_platform / to_girl（与 transaction_type 强绑定） |
| amount | DECIMAL(10,2) | 是 | - | 本次结账/提现金额（正数），withdrawal时为人民币，settlement时为泰铢 |
| exchange_rate | DECIMAL(10,4) | 否 | NULL | 申请提现时的参考汇率（CNY to THB），仅withdrawal类型使用 |
| service_fee_rate | DECIMAL(5,4) | 否 | NULL | 服务费率（固定0.01，即1%），仅withdrawal类型使用 |
| actual_amount_thb | DECIMAL(10,2) | 否 | NULL | 实际打款泰铢金额（管理员确认时填写），仅withdrawal类型使用 |
| payment_method | TEXT | 否 | NULL | 支付方式：cash/wechat/alipay/bank 等 |
| payment_proof_url | TEXT | 否 | NULL | 支付凭证截图 URL（技师结账时通常必传） |
| notes | TEXT | 否 | NULL | 备注说明（如账号信息、特殊情况） |
| status | TEXT | 是 | 'pending' | 审核状态：pending/confirmed/cancelled |
| operator_id | UUID | 否 | NULL | 审核人/操作人ID（管理员），仅在 confirmed/cancelled 时填写 |
| confirmed_at | TIMESTAMPTZ | 否 | NULL | 审核通过时间（status = confirmed 时） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_settlement_tx_girl_id (girl_id, created_at DESC)
- INDEX idx_settlement_tx_type (transaction_type)
- INDEX idx_settlement_tx_status_pending (status) WHERE status = 'pending'
- INDEX idx_settlement_transactions_withdrawal (girl_id, transaction_type, created_at DESC) WHERE transaction_type = 'withdrawal'

**外键约束**：
- FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
- FOREIGN KEY (operator_id) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (transaction_type IN ('settlement', 'withdrawal'))
- CHECK (direction IN ('to_platform', 'to_girl'))
- CHECK ((transaction_type = 'settlement' AND direction = 'to_platform') OR (transaction_type = 'withdrawal' AND direction = 'to_girl'))
- CHECK (amount > 0)
- CHECK (status IN ('pending', 'confirmed', 'cancelled'))
- CHECK (exchange_rate IS NULL OR exchange_rate > 0)
- CHECK (service_fee_rate IS NULL OR (service_fee_rate >= 0 AND service_fee_rate <= 1))
- CHECK (actual_amount_thb IS NULL OR actual_amount_thb > 0)

**说明**：
- **本表只记录**：
  - 技师向平台结账（THB）：上传付款截图，待财务确认
  - 技师向平台提现（RMB）：待财务打款确认
- **字段含义**：
  - `transaction_type`：`settlement`（技师结账，THB）/ `withdrawal`（技师提现，RMB）
  - `direction`：`settlement` 固定为 `to_platform`；`withdrawal` 固定为 `to_girl`
  - `amount`：`settlement` 时为 THB 金额（≤ 当前 balance）；`withdrawal` 时为 RMB 金额（≤ 当前 platform_collected_rmb_balance）
  - `status`：`pending`（待对账）/ `confirmed`（已确认，触发余额更新）/ `cancelled`（作废，不触发余额变化）
- **记账逻辑**（`status` 从 `pending` → `confirmed` 时）：
  - `settlement / to_platform`：从 `girl_settlement_accounts.balance` 中减去 `amount`（THB 欠款减少）
  - `withdrawal / to_girl`：从 `girl_settlement_accounts.platform_collected_rmb_balance` 中减去 `amount`（RMB 代收减少）
- **风控与业务限制**（在 RPC/服务层校验）：
  - 技师发起 `settlement`：仅当 `balance > 0` 时允许，且 `amount` ≤ 当前 `balance`
  - 技师发起 `withdrawal`：仅当 `platform_collected_rmb_balance` ≥ 最小提现额度时允许，且 `amount` ≤ 当前 `platform_collected_rmb_balance`
  - 一条记录从 `pending` 变为 `confirmed/cancelled` 后，不允许修改 `amount`、`transaction_type` 和 `direction`
- **不再使用** `order_id`、`order_settlement_id` 字段，已从表结构中移除
- 所有记录不可物理删除，只允许新增和更新 `status` / `notes` / `operator_id` / `confirmed_at` 等字段

---

## order_platform_payments（订单平台收款明细表）

**支持一个订单多次平台代收**：记录技师通过平台收款码代收的每一笔款项（定金/尾款/小费等），自动汇总到 `order_settlements.actual_paid_amount`。

| 字段名 | 数据类型 | 必填 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| id | UUID | 是 | gen_random_uuid() | 主键 |
| order_settlement_id | UUID | 是 | - | 关联订单结算记录ID |
| amount_rmb | DECIMAL(10,2) | 是 | - | 本次收款人民币金额 |
| payment_content_type | TEXT | 是 | - | 支付内容类型：deposit(定金)/full_amount(全款)/tip(小费)/other(其他) |
| payment_method | TEXT | 是 | - | 支付方式：wechat(微信)/alipay(支付宝)/other(其他) |
| proof_url | TEXT | 是 | - | 收款截图URL |
| notes | TEXT | 否 | NULL | 备注说明（如"补尾款"、"加钟小费"） |
| created_by | UUID | 是 | - | 创建人（技师用户ID） |
| created_at | TIMESTAMPTZ | 是 | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | 是 | NOW() | 更新时间 |

**索引**：
- PRIMARY KEY (id)
- INDEX idx_order_platform_payments_settlement (order_settlement_id, created_at DESC)
- INDEX idx_order_platform_payments_creator (created_by)
- INDEX idx_order_platform_payments_created (created_at DESC)

**外键约束**：
- FOREIGN KEY (order_settlement_id) REFERENCES order_settlements(id) ON DELETE CASCADE
- FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL

**CHECK约束**：
- CHECK (payment_content_type IN ('deposit', 'full_amount', 'tip', 'other'))
- CHECK (payment_method IN ('wechat', 'alipay', 'other'))
- CHECK (amount_rmb > 0)

**说明**：
- **设计目标**：
  - 支持一个订单多次平台代收（定金→尾款→小费）
  - 所有平台收款必须绑定到具体订单，防止作弊
  - 便于财务按订单核对
- **汇总逻辑**（由触发器自动维护）：
  - 每次 INSERT/UPDATE/DELETE 本表记录时，自动重新计算该订单的 `SUM(amount_rmb)`
  - 将汇总结果写回 `order_settlements.actual_paid_amount`
  - 订单核验通过（`settlement_status = 'settled'`）时，`actual_paid_amount` 累加到 `girl_settlement_accounts.platform_collected_rmb_balance`
- **录入规则**：
  - 必须从订单详情页录入，不提供"全局无订单收款入口"
  - 仅在订单状态为 `confirmed/arrived/en_route/in_service` 时可操作
  - 订单 `completed` 后保留短时间窗口（如 30 分钟）允许补录或微调
  - 订单被财务标记为 `settled` 后，所有明细变为只读
- **编辑限制**：
  - 创建后短时间内（10-30 分钟）允许修改金额/备注
  - 截图建议只能删后重建
  - 订单核验通过后不可编辑

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
| last_auto_busy_reply_at | TIMESTAMPTZ | 否 | NULL | 最后一次发送"忙碌中"自动回复的时间（防止重复回复，2小时冷却期） |
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
- INDEX idx_chat_threads_auto_busy_reply (last_auto_busy_reply_at) WHERE last_auto_busy_reply_at IS NOT NULL
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
