# 用户管理开发说明（已完成）

## 实现状态：✅ 完成

已完成用户管理功能的完整实现，包括：

### 已实现功能
- ✅ 用户列表页面 (`/dashboard/users`)
- ✅ 用户详情页面 (`/dashboard/users/[id]`)
- ✅ 用户资料编辑（仅超级管理员）
- ✅ 用户封禁/解禁（仅超级管理员）
- ✅ 用户密码重置（仅超级管理员）
- ✅ 登录记录查看
- ✅ 绑定账号查看
- ✅ 审计日志记录
- ✅ 权限控制（admin只读，superadmin可写）

### 技术实现
- **类型定义**: `lib/types/user.ts`
- **验证模式**: `lib/validations/user.ts`
- **审计日志**: `lib/audit.ts`
- **服务端操作**: `app/dashboard/users/actions.ts`
- **页面组件**: `app/dashboard/users/page.tsx`, `app/dashboard/users/[id]/page.tsx`
- **UI组件**: `components/users/` 目录下的所有组件

### RLS策略
使用现有的RLS策略，支持：
- admin/superadmin 可读取所有用户资料
- 仅 superadmin 可更新用户资料
- 审计日志记录所有写操作

### 优化建议
- 列表查询已优化，支持搜索、筛选、分页
- 使用复合索引提升查询性能
- 敏感操作需二次确认
- 所有写操作都记录审计日志

---

# 原开发说明（参考）

## 页面功能清单
A. 用户列表（/dashboard/users）

查询字段：user_profiles 的 display_name/username/country_code/language_code/level/is_banned/created_at 等；支持关键词搜索（display_name/username）、筛选（被封禁、国家、语言、时间范围）、排序（创建时间/等级），分页（偏好 keyset，退而求其次 limit/offset）。 

行内信息：头像、显示名、用户名、国家/语言、等级、是否封禁、最近一次登录时间（联 user_login_events 最新一条）。 


列表行操作（仅 superadmin 可见）：封禁/解禁开关（写 user_profiles.is_banned）、重置密码入口（见写操作）。RLS 已限制：user_profiles 全量更新仅 superadmin 合法。 


B. 用户详情（/dashboard/users/[id]）

基本资料卡片：display_name/username/avatar_url/country_code/language_code/timezone/level/credit_score/is_banned/created_at/updated_at。编辑/保存仅 superadmin；admin 只读。 


登录记录卡片：读取 user_login_events（最近 50 条，设备、IP、UA、登录方式、时间）。admin/superadmin 可读。 


绑定账号卡片：读取 user_connected_accounts（provider、邮箱、主登录 is_primary）。admin/superadmin 可读；不在后台直接改第三方绑定（遵循前台流程）。 

操作区（仅 superadmin）：封禁/解禁、更新基本信息、重置密码。

## 数据获取与写操作规范
只读查询（RSC）

直接用 @supabase/auth-helpers-nextjs 的 server client 以当前管理员身份读取。

查询严格遵循 RLS：

列表/详情读 user_profiles：admin/superadmin 均可 SELECT（RLS 已允许）。 

读 user_login_events、user_connected_accounts：admin/superadmin 均可 SELECT。 

写操作（Server Actions）

更新资料（仅 superadmin）：允许改 display_name/username/language_code/timezone/level/credit_score/is_banned 等非敏感字段（字段范围以 DB.md 为准）。每次写入成功后同步写 admin_operation_logs（operation_type: update_user_profile）。 

封禁/解禁（仅 superadmin）：切换 user_profiles.is_banned，并写 admin_operation_logs（operation_type: toggle_user_ban，operation_details 记录前后值）。 

重置密码（仅 superadmin）：在 Server Action 中使用 SUPABASE_SERVICE_ROLE_KEY 调用 Admin API（auth.admin.updateUserById），严禁在客户端曝光；成功后写 admin_operation_logs（operation_type: reset_user_password，不回写明文密码，仅记录被操作的 user_id 与“已触发重置”）。RLS 对日志表已允许 superadmin 插入/查询。 

环境变量：读取 SUPABASE_SERVICE_ROLE_KEY 于 Server Action；前端永不暴露。此键已在项目文档中明确区分开发/生产配置路径。 

## UI/UX 与组件（shadcn/ui）

列表：DataTable（支持搜索输入框、筛选下拉、受控分页、加载/空态/错误态）。

详情：三卡片（基本资料 / 登录记录 / 绑定账号）。敏感操作加 二次确认对话框。

权限可见性：按钮与表单字段按角色条件渲染（admin 隐藏写按钮）。

表单：RHF + Zod；错误消息友好展示；提交中禁用按钮，成功后 toast。

## 审计日志（必须）

新建 lib/audit.ts：导出 logAdminOperation(actorId, payload)，由所有 Server Actions 复用，向 admin_operation_logs 插入：

operator_id = actorId（当前管理员 auth.uid()）

target_admin_id = null，若操作的是用户，在 operation_details 写 target_user_id（不新增列，走 JSONB）。

operation_type ∈ update_user_profile / toggle_user_ban / reset_user_password

operation_details：输入模型（脱敏后）

仅在写成功后记录日志；写失败不落审计但要抛出明确错误提示。

确认 admin_operation_logs 的 RLS 政策允许 superadmin 插入/查询（文档已有策略）。 

## One-Page Loop 执行顺序（务必照做）

路由壳与路由守卫 → 未授权重定向 /login。 

只读列表/详情打通，含加载/空态/错误处理。

最小写操作：先做“封禁/解禁”，再做“更新资料”；全部走 Server Actions + 审计。

冒烟测试：

用 admin 账户查看无写按钮；用 superadmin 账户能正常写；

RLS 误触：模拟 admin 调写接口应被拒；

审计：完成一轮写操作后，能在 DB 看到对应日志。

文档同步：如对 UI 操作文案/按钮有新增，给出 1–3 行变更说明（不改 DB/RLS）。

## 验收标准（DoD）

/dashboard/users 可按条件查询分页，性能 OK；

/dashboard/users/[id] 可查看三卡片数据；

仅 superadmin 能封禁/解禁、更新资料、重置密码；

所有写操作均落 admin_operation_logs；

未发生越权写；列表/详情的加载、空态、错误态状态管理完整；

代码放置位置/类型与 lib/types/*、lib/validations/* 分层一致。 


## 额外实现注意

查询尽量 keyset（created_at,id 复合游标）以兼容大表；

不在后台直接操作第三方绑定改绑（只读展现即可）；

重置密码调用 Admin API 后不返回任何敏感字段，仅提示“已触发重置”；

禁止在客户端/日志写入明文密码或 token；

列表与详情的服务端查询要加索引字段排序/过滤（见 DB.md 推荐索引）。