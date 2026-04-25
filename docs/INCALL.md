# Incall（到店预约）功能设计文档

> 文档版本：v1.0 | 更新时间：2026-04-20  
> 本文档描述 CBODY 平台新增"到店预约（Incall）"功能的数据库设计方案及开发说明。  
> **不修改现有表结构逻辑和代码**，仅在现有基础上最小代价扩展。

---

## 一、背景说明

平台目前仅支持上门服务（Outcall）。新增到店预约（Incall）模式，允许技师配置自己的到店地址，顾客可在下单时选择到店或上门。

**核心规则**：
- 支持 Incall 的技师是少数，设计需轻量
- Incall 地址可能是共享的（如门店地址），也可能是技师独立房间
- Incall 无出行费
- Incall 有顾客意向预约时间，但最终需技师手动确认（与 Outcall 确认流程一致）
- 确认后 Incall / Outcall 无差别，统一进入原有排队系统
- 提成比例、结算系统、价格体系完全一致，不做区分

---

## 二、数据库变更方案

### 2.1 新增独立表：`incall_locations`（到店地址表）

> **设计原因**：地址可能被多个技师共用（如同一门店的多名技师），因此提取为独立表，便于复用和管理。

```sql
CREATE TABLE incall_locations (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,                    -- 地点名称，如 "Thai Heaven Spa · Room 301"
  address       TEXT          NOT NULL,                    -- 展示用详细地址
  lat           DOUBLE PRECISION NOT NULL,                 -- 纬度（用于地图跳转）
  lng           DOUBLE PRECISION NOT NULL,                 -- 经度
  place_id      TEXT          NULL,                        -- Google Place ID（优先，跳地图更精准）
  city_id       INTEGER       NULL REFERENCES cities(id) ON DELETE SET NULL,
  photos        TEXT[]        NOT NULL DEFAULT '{}',       -- 房间/环境图片 URL 列表
  meta          JSONB         NOT NULL DEFAULT '{}',       -- 扩展字段（预留楼层/门禁/注意事项等）
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_by    UUID          NULL REFERENCES auth.users(id) ON DELETE SET NULL,  -- 创建人（管理员）
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_incall_locations_city (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_incall_locations_active (is_active) WHERE is_active = true;
CREATE INDEX idx_incall_locations_created_by (created_by) WHERE created_by IS NOT NULL;
```

**`meta` 字段结构示例**：
```json
{
  "floor": "3F",
  "entrance_note": "扫码进门，电梯直达3楼",
  "parking": "地下停车免费"
}
```

**`photos` 字段说明**：
- 存储 Supabase Storage 图片 URL 列表
- 前端客户端可展示房间/环境轮播图
- 建议最多 9 张

---

### 2.2 `girls` 表新增字段（仅 2 个）

> **设计原因**：支持 Incall 的技师是少数，不宜在 girls 表堆砌多列。用一个布尔开关 + 一个外键引用即可。

```sql
-- 是否支持到店接待
ALTER TABLE girls ADD COLUMN incall_enabled BOOLEAN NOT NULL DEFAULT false;

-- 关联到店地址（NULL = 未配置或不支持）
ALTER TABLE girls ADD COLUMN incall_location_id UUID NULL REFERENCES incall_locations(id) ON DELETE SET NULL;

-- 索引
CREATE INDEX idx_girls_incall ON girls(incall_enabled) WHERE incall_enabled = true;
CREATE INDEX idx_girls_incall_location (incall_location_id) WHERE incall_location_id IS NOT NULL;
```

**说明**：
- `incall_enabled = true` 且 `incall_location_id IS NOT NULL` → 才展示 Incall 标签
- 一个技师绑定一个地址；如果一家门店有 5 名技师，她们共用同一条 `incall_locations` 记录
- 技师自己有独立房间时，单独创建一条 `incall_locations` 记录，自己绑定
- 地址的增删改由管理员在后台操作

---

### 2.3 `orders` 表新增字段（3 个）

```sql
-- 服务类型：outcall（上门）/ incall（到店），默认上门
ALTER TABLE orders ADD COLUMN service_type TEXT NOT NULL DEFAULT 'outcall';

-- 顾客意向预约时间（incall 专用，15 分钟为单位，当日至次日）
-- 仅作为告知技师的意向时间，不自动触发任何系统行为
ALTER TABLE orders ADD COLUMN incall_requested_at TIMESTAMPTZ NULL;

-- 到店地址快照（下单时将技师 incall 地址信息快照进来，防止地址事后被修改影响历史订单）
ALTER TABLE orders ADD COLUMN incall_location_snapshot JSONB NULL;

-- 约束
ALTER TABLE orders ADD CONSTRAINT chk_orders_service_type
  CHECK (service_type IN ('outcall', 'incall'));

-- incall 时 travel_fee 必须为 0
ALTER TABLE orders ADD CONSTRAINT chk_orders_incall_travel_fee
  CHECK (service_type != 'incall' OR travel_fee = 0);

-- outcall 时 incall_requested_at 必须为 NULL
ALTER TABLE orders ADD CONSTRAINT chk_orders_outcall_no_incall_time
  CHECK (service_type != 'outcall' OR incall_requested_at IS NULL);

-- 索引
CREATE INDEX idx_orders_service_type ON orders(service_type);
CREATE INDEX idx_orders_incall_requested ON orders(incall_requested_at) WHERE incall_requested_at IS NOT NULL;
```

**`incall_location_snapshot` JSONB 结构**：
```json
{
  "location_id": "uuid",
  "name": "Thai Heaven Spa · Room 301",
  "address": "123 Sukhumvit Rd, Bangkok",
  "lat": 13.7563,
  "lng": 100.5018,
  "place_id": "ChIJxxxxxxxx",
  "photos": ["https://...", "https://..."]
}
```

---

### 2.4 其他表变更

| 表名 | 是否变动 | 说明 |
|------|---------|------|
| `order_settlements` | **不变** | 提成逻辑完全复用 |
| `girl_settlement_accounts` | **不变** | 余额逻辑完全复用 |
| `settlement_transactions` | **不变** | 提现/结账逻辑完全复用 |
| `girls_status` | **不变** | `next_available_time` 自动兼容 |
| `order_cancellations` | **不变** | 取消流程一致 |
| `order_reviews` | **不变** | 评价流程一致 |
| `girl_work_sessions` | **不变** | 统计逻辑一致 |

---

## 三、确认流程设计

### 3.1 Outcall（上门）现有流程（不变）
```
顾客下单 → pending → 技师人工确认 → confirmed → en_route → arrived → in_service → completed
```

### 3.2 Incall（到店）新流程
```
顾客下单（含意向时间）→ pending → 技师确认（在意向时间前10-20分钟手动确认）→ confirmed → in_service → completed
```

**关键说明**：
- `incall_requested_at` 仅是顾客告知技师的**意向时间**，不自动触发状态变更
- 技师收到订单后，通过聊天与顾客沟通确认，**手动点击确认**
- 确认后订单进入 `confirmed` 状态，与 Outcall 完全一致，进入同一排队系统
- Incall 无 `en_route` / `arrived` 状态（顾客自己去店里），系统不强制，但也不阻断
- `booking_mode` Incall 时设为 `'flex'`，`eta_minutes = 0`，`estimated_arrival_at = incall_requested_at`，排队链自动兼容

---

## 四、涉及冲突点分析

### 4.1 排队系统
- Incall 下单时：`eta_minutes = 0`，`estimated_arrival_at = incall_requested_at`
- 排队触发器读取 `estimated_arrival_at` 时 Incall 自动兼容，**无需修改触发器**

### 4.2 距离过滤
- `max_travel_distance` 仅用于 Outcall 距离筛选
- Incall 技师在搜索时跳过距离限制，前端/查询层按 `incall_enabled` 标记处理

### 4.3 地址字段
- Outcall 时：`address_snapshot` 正常填用户地址，`incall_location_snapshot = NULL`，`service_address_id` 正常使用
- Incall 时：`address_snapshot = '{}'`，`incall_location_snapshot` 填技师地址快照，`service_address_id = NULL`，`latitude / longitude = NULL`

### 4.4 `work_hours` 字段
- 已知该字段目前实际未在业务逻辑中使用（技师手动打卡上下班）
- Incall 意向时间**不做 `work_hours` 校验**，由技师自行决定是否确认

### 4.5 取消规则
- Incall 与 Outcall 取消规则完全一致，`order_cancellations` 无需改动

### 4.6 推送通知
- 前端/通知层根据 `service_type` 决定是否显示/发送 `en_route` / `arrived` 相关推送
- 数据库枚举值不变，业务层跳过即可

### 4.7 结算系统
- 提成比例、价格体系、结算流程完全一致，**无任何差异**

---

## 五、前端开发关键点

### 5.1 技师列表 / 详情页
- `incall_enabled = true` 且 `incall_location_id IS NOT NULL` → 显示 `Incall Available` 标签
- 技师详情页展示到店地址名称、地址文本、环境图片轮播（`incall_locations.photos`）
- 展示"地图跳转"按钮：优先用 `place_id` 拼接 Maps URL，无则用经纬度

**Google Maps URL**：
```
https://www.google.com/maps/place/?q=place_id:{place_id}
// 或
https://www.google.com/maps?q={lat},{lng}
```

**Apple Maps URL**：
```
https://maps.apple.com/?ll={lat},{lng}&q={name}
```

### 5.2 下单确认页
- 默认选中 `Outcall`（上门）
- 若技师 `incall_enabled = true`，显示切换 Tab：`Outcall | Incall`
- 切换到 `Incall`：
  - 隐藏用户地址选择区域
  - 展示技师到店地址（名称 + 地址文本 + 地图跳转按钮）
  - 显示时间选择器（15 分钟为单位，当前时间起 ~ 次日 23:59，向上取整到最近 15 分钟）
  - 出行费自动清零显示
  - 价格小计与 Outcall 完全一致

### 5.3 订单详情页（三端）
- 根据 `service_type` 显示 `Incall` 或 `Outcall` 标签
- Incall 订单：显示到店地址（来自 `incall_location_snapshot`）+ 地图跳转按钮
- Incall 订单：显示顾客意向时间（`incall_requested_at`）
- Incall 订单：不显示 `en_route` / `arrived` 状态节点（或灰显）

### 5.4 技师端（Go App）
- 收到 Incall 订单通知：推送中注明"到店预约"+ 意向时间
- 技师确认流程与 Outcall 完全一致，手动点击确认
- 建议：确认按钮附近提示"顾客意向时间：{incall_requested_at}"

### 5.5 管理后台
- 新增"到店地址管理"页面：增删改 `incall_locations` 记录（含图片上传）
- 技师编辑页新增：Incall 开关 + 绑定地址选择
- 订单列表新增 `service_type` 筛选标签

---

## 六、涉及表变更汇总

| 表名 | 变动 | 内容 |
|------|------|------|
| `incall_locations` | **新建** | 到店地址表，支持多技师共用 |
| `girls` | 新增 2 字段 | `incall_enabled` + `incall_location_id` |
| `orders` | 新增 3 字段 | `service_type` + `incall_requested_at` + `incall_location_snapshot` |
| 其余所有表 | **不变** | 结算、排队、评价、聊天全部复用 |

---

## 七、RLS 策略补充建议

### `incall_locations` 表
```sql
-- 所有人可读已激活地址
CREATE POLICY "incall_locations_select" ON incall_locations
  FOR SELECT USING (is_active = true);

-- 仅管理员可增删改
CREATE POLICY "incall_locations_admin_write" ON incall_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid() AND is_active = true)
  );
```

---

## 八、后续可扩展方向（预留，暂不实现）

- `incall_locations` 的 `meta` 字段已预留：楼层、门禁、停车、Wi-Fi 等信息
- `photos` 字段已支持多图，后续可扩展图片审核流程
- 若未来需要按到店地址统计订单量，可直接 JOIN `incall_location_snapshot->>'location_id'`
- 若未来 Incall 需要独立取消规则，可在 `order_cancellations.reason_code` 层面扩展，无需改表结构
