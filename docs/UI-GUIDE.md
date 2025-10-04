# UI 指南

- 优先使用 **shadcn/ui** ，如果没有该组件先提示我安装最新版的shadcnUI组件，除非没有或者我有特别要求，才考虑用Tailwind创建到components中，并且以页面命名，比如当前组件是关于技师的，新建组件放在/components/girls/文件夹下；其他类型也要这种方式创建；
- 支持 **明亮 / 暗黑模式**  
- 其他设计细节：仅在有单独参考文件时再补充

## UI 组件规范
```typescript
// 统一使用 shadcn/ui 组件
import { 
  Button, 
  Table, 
  Dialog, 
  Form, 
  Input, 
  Select,
  Badge,
  Card,
  Tabs,
  Toast
} from "@/components/ui"

// 组件设计原则
- 响应式设计 (移动端友好)
- 无障碍访问 (ARIA 标签)
- 加载状态和错误处理
- 统一的视觉风格
- 国际化支持预留