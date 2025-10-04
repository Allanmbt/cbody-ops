# CBODY-OPS — 产品概要

## 愿景
为 CBODY 平台提供一个简洁、稳定、可扩展的后台管理系统。  

## 开发方式
- **逐页实现**：一个页面一个页面完成 → 测试 → 文档更新
- **公共文档稳定**：`DB.md`、`RLS.md`、`UI-GUIDE.md`

### 项目结构
```
cbody-ops/
├── app/                    # Next.js 15 App Router
│   ├── login/             # 登录页面
│   ├── dashboard/         # 仪表盘首页
│   │   ├── managements/         # 管理员管理
│   │   ├── girls/             # 技师管理
│   │   ├── services/          # 服务管理
│   │   ├── orders/            # 订单管理
│   │   └── reports/           # 报表统计
│   ├── globals.css        # 全局样式
│   └── layout.tsx         # 根布局
├── components/            # 可复用组件
│   ├── ui/               # shadcn/ui 组件
│   ├── admin/            # 管理员相关组件
│   ├── layout/           # 布局组件
│   └── common/           # 通用组件
├── lib/                  # 工具函数和配置
│   ├── supabase.ts       # Supabase 客户端配置
│   ├── auth.ts           # 认证相关工具
│   ├── types.ts          # TypeScript 类型定义
│   └── utils.ts          # 通用工具函数
└── docs/                 # 项目文档
    └── DB.md             # 数据库设计文档
```

## 角色权限体系

### 管理员角色定义
```typescript
type AdminRole = 'superadmin' | 'admin' | 'finance' | 'support'
```

### 权限矩阵
| 功能模块 | 超级管理员 | 管理员 | 财务 | 客服 |
|---------|-----------|--------|------|------|
| 管理员管理 | ✅ | ❌ | ❌ | ❌ |
| 技师管理 | ✅ | ✅ | ❌ | ✅ (只读) |
| 服务管理 | ✅ | ✅ | ❌ | ❌ |
| 订单管理 | ✅ | ✅ | ✅ | ✅ |
| 财务报表 | ✅ | ❌ | ✅ | ❌ |
| 系统设置 | ✅ | ❌ | ❌ | ❌ |

### 核心权限控制
- **路由守卫**: 基于用户角色控制页面访问
- **组件权限**: 条件渲染操作按钮和功能区块
- **API 权限**: Supabase RLS 策略保护数据访问
- **操作日志**: 记录所有敏感操作和权限变更

## 核心业务模块

### 1. 管理员管理
**权限**: 仅超级管理员可访问

**功能清单**:
- 查看管理员列表 (显示名、角色、状态、创建时间)
- 添加管理员
- 修改管理员显示名
- 重置管理员密码
- 启用/禁用管理员账号
- 查看操作日志记录

**技术要点**:
```typescript
// 权限检查 Hook
const useAdminPermissions = () => {
  // 检查当前用户是否为超级管理员
  // 返回权限状态和加载状态
}

// 管理员操作 API
const adminOperations = {
  updateDisplayName: async (adminId: string, displayName: string) => {},
  resetPassword: async (adminId: string, newPassword: string) => {},
  toggleStatus: async (adminId: string, isActive: boolean) => {},
}
```

---

### 2. 技师管理
**权限**: 管理员、超级管理员可管理，客服只读

**功能清单**:
- 技师列表查看 (支持搜索、筛选、分页)
- 技师详情查看、新增/编辑
- 技师服务项目绑定
- 技师状态和位置监控
- 技师媒体资源管理

**关键特性**:
- 实时状态更新 (available/busy/offline)
- 地理位置可视化显示
- 服务定价范围控制
- 多语言内容管理

---

### 3. 服务管理
**权限**: 管理员、超级管理员可管理

**功能清单**:
- `/dashboard/services` 服务管理页面
- 服务列表展示（分页、搜索、筛选）
- 服务新建/编辑功能
- 时长定价配置
- 服务上下架控制
- 一键上下架切换

---

### 4. 订单管理
**权限**: 所有角色可访问，功能权限有差异

**功能清单**:
- 订单列表查看 (支持多维度筛选)
- 订单详情查看
- 订单状态更新 (客服/管理员)
- 退款处理 (财务/管理员)
- 纠纷处理记录

**状态流转**:
`pending` → `confirmed` → `in_progress` → `completed` → `reviewed`

---

### 5. 用户管理

**权限**: 超级管理员可增删改，管理员只读/可部分操作，客服只读

**功能清单**:

* 用户列表查看 (支持搜索、筛选、分页)
* 用户详情查看、编辑基本信息
* 用户封禁/解禁管理
* 用户登录记录查看
* 用户绑定账号查看

**关键特性**:

* 多条件筛选 (用户名、邮箱、注册时间、状态等)
* 分页与排序 (创建时间/活跃度)
* 审计日志记录所有写操作
* 服务端安全校验 (RLS 策略 + Server Action)
* 多语言显示支持（基础信息国际化）

---

### 5. 财务报表
**权限**: 超级管理员、财务可访问

**报表类型**:
- 收入统计 (日/周/月/年度)
- 技师收入排行榜
- 服务热度分析
- 用户消费分析
- 退款统计报表

## 安全考虑

### 1. 数据安全
- **RLS 策略**: 表级别权限控制，确保数据隔离
- **敏感信息**: 密码、手机号等字段加密存储
- **访问日志**: 记录所有敏感操作，支持审计追踪
- **API 限流**: 防止接口被恶意调用

### 2. 前端安全
- **路由守卫**: 未授权用户自动重定向到登录页
- **Token 管理**: JWT 自动续期，安全退出清理
- **XSS 防护**: 用户输入内容严格过滤和转义
- **HTTPS 强制**: 生产环境强制使用 HTTPS

### 3. 运营安全
- **操作确认**: 敏感操作要求二次确认
- **权限最小化**: 每个角色只能访问必要的功能
- **会话管理**: 长时间无操作自动退出
- **异常监控**: 异常登录和操作行为告警

## 性能优化

### 1. 前端优化
- **代码分割**: 路由级别懒加载，减少初始包大小
- **图片优化**: 支持 WebP 格式，CDN 加速
- **缓存策略**: API 响应适当缓存，减少重复请求
- **虚拟滚动**: 大列表使用虚拟滚动技术

### 2. 数据库优化
- **索引优化**: 高频查询字段建立合适索引
- **分页查询**: 大数据量列表支持分页加载
- **连接池管理**: 控制数据库连接数量
- **查询优化**: 避免 N+1 查询问题

## 开发和部署

### 环境配置
```bash
# 开发环境 (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key
# 生产环境
NEXT_PUBLIC_SUPABASE_URL=your_prod_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_dev_service_role_key
```

### 开发流程
1. **本地开发**: `npm run dev` 启动开发服务器
2. **代码规范**: ESLint + Prettier 保证代码质量
3. **类型检查**: TypeScript 严格模式开启
4. **测试**: 单元测试 + 集成测试覆盖核心功能

### 部署策略
- **平台**: Vercel / 自建服务器
- **域名**: adminmyes.cbody.vip (生产环境)
- **SSL**: 自动 HTTPS 证书管理
- **CDN**: 静态资源 CDN 加速

---