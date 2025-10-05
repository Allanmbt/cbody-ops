# 技师头像上传功能实现说明

## ✅ 已完成功能

### 1. 图片裁剪组件 (`GirlImageCropper.tsx`)
- **位置**: `components/girls/GirlImageCropper.tsx`
- **功能特性**:
  - ✅ 支持三种裁剪比例选择：
    - 3:4 (竖版) - 默认比例
    - 1:1 (方形)
    - 9:16 (超竖)
  - ✅ 图片缩放功能 (0.5x ~ 3x)
  - ✅ 图片旋转功能 (90度增量)
  - ✅ 重置功能
  - ✅ **保持原图质量**：质量参数设置为 1.0，无压缩

### 2. 头像上传逻辑 (`GirlFormDialog.tsx`)
- **位置**: `components/girls/GirlFormDialog.tsx`
- **实现流程**:
  1. 用户选择图片 → 触发裁剪器
  2. 裁剪完成 → 生成 Blob，转换为 File
  3. 表单提交时 → 上传到 Supabase Storage (`upload/avatars/`)
  4. 上传成功 → 获取 publicUrl
  5. 保存到数据库 `girls.avatar_url`

- **上传配置**:
  ```typescript
  - Storage Bucket: 'upload'
  - 路径: 'avatars/{timestamp}_{filename}'
  - 缓存: 3600 秒
  - 自动覆盖: false
  ```

### 3. 用户绑定功能优化 (`actions.ts`)
- **位置**: `app/dashboard/girls/actions.ts`
- **搜索能力增强**:
  - ✅ 支持通过 `user_id` 精确搜索
  - ✅ 支持通过 `email` 模糊搜索（包含 @ 符号）
  - ✅ 支持通过 `phone` 模糊搜索（纯数字）
  - ✅ 支持通过 `display_name` 模糊搜索

- **用户信息显示**:
  - 优先显示：`phone` > `email` > `display_name`
  - 编辑技师时自动加载已绑定用户信息
  - 显示格式：`{phone/email} • {display_name} • {user_id}`

## 📦 新增依赖

```bash
npm install react-image-crop
```

已安装版本会自动添加到 `package.json`

## 🔧 使用方法

### 1. 新建技师并上传头像
```
1. 点击"新建技师"按钮
2. 点击头像区域选择图片
3. 在裁剪器中选择比例（3:4 / 1:1 / 9:16）
4. 调整缩放、旋转
5. 点击"确认裁剪"
6. 填写其他信息
7. 提交表单 → 流程：
   a. 先创建技师记录（获取 girl_id）
   b. 上传头像到 avatars/{girl_id}/ 文件夹
   c. 更新技师的 avatar_url
```

### 2. 编辑技师并更换头像
```
1. 点击技师列表中的"编辑"
2. 已绑定用户会自动显示（手机号/邮箱）
3. 点击头像区域选择新图片
4. 裁剪后提交 → 更新头像
```

### 3. 绑定用户账号
```
1. 在"用户绑定"区域输入：
   - 用户 ID（36位UUID）
   - 邮箱（包含@符号）
   - 手机号（纯数字）
   - 昵称（至少3个字符）
2. 按回车或点击搜索按钮
3. 从结果列表选择用户
4. 已绑定用户显示为绿色卡片
```

## 🗂️ Supabase Storage 结构

```
upload/
└── avatars/
    ├── {girl_id_1}/
    │   ├── 1733829384729_avatar.jpg
    │   ├── 1733829485832_avatar_2.jpg
    │   └── ...
    ├── {girl_id_2}/
    │   ├── 1733829584729_avatar.jpg
    │   └── ...
    └── ...
```

**路径格式**: `avatars/{girl_id}/{timestamp}_{原文件名}`
**优势**: 
- 每个技师的头像独立文件夹，方便管理和查找
- 支持多个历史头像保存
- 便于批量操作和清理

## ⚠️ 注意事项

### 1. Storage 配置
确保 Supabase Storage 中的 `upload` bucket 已创建并设置为 **public**：
```sql
-- 在 Supabase Dashboard → Storage → upload bucket
-- Settings → Public: ON
```

### 2. RLS 策略
确保有适当的 Storage RLS 策略允许上传：
```sql
-- 允许认证用户上传到 avatars 文件夹
CREATE POLICY "Allow authenticated uploads to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'upload' AND (storage.foldername(name))[1] = 'avatars');

-- 允许所有人读取 avatars
CREATE POLICY "Allow public read access to avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'upload' AND (storage.foldername(name))[1] = 'avatars');
```

### 3. 图片质量
- **无压缩**: `canvas.toBlob()` 的质量参数设置为 `1.0`
- **格式**: JPEG
- **DPI**: 使用 `window.devicePixelRatio` 适配高分辨率屏幕

### 4. 用户绑定问题修复
- ✅ 已修复编辑时不显示已绑定用户的问题
- ✅ `searchUsers` 函数现在支持通过 `user_id` 直接查询
- ✅ `loadUserInfo` 函数会在编辑对话框打开时自动调用

## 🧪 测试清单

- [ ] 新建技师 → 上传头像 → 保存成功
- [ ] 编辑技师 → 更换头像 → 更新成功
- [ ] 裁剪比例切换 → 3:4 / 1:1 / 9:16 正常工作
- [ ] 图片缩放 → 0.5x ~ 3x 正常
- [ ] 图片旋转 → 90度增量正常
- [ ] 重置功能 → 恢复初始状态
- [ ] 用户绑定 → 搜索显示正确
- [ ] 编辑已绑定用户的技师 → 用户信息自动显示
- [ ] 上传后头像在列表中正确显示
- [ ] 头像在 Supabase Storage 中正确存储

## 📝 相关文件

- `components/girls/GirlImageCropper.tsx` - 裁剪器组件
- `components/girls/GirlFormDialog.tsx` - 表单对话框（含上传逻辑）
- `app/dashboard/girls/actions.ts` - Server Actions（含用户搜索）
- `lib/supabase.ts` - Supabase 客户端配置

## 🎨 用户绑定样式优化

已绑定用户的显示样式已优化：
- ✅ 使用 `border-primary` 主色调边框
- ✅ 淡色背景 `bg-primary/5`
- ✅ 使用 Badge 组件显示用户信息
- ✅ 移除随意的背景色，保持设计一致性
- ✅ 悬停效果优化（解绑按钮）

## 🎉 完成状态

- ✅ 头像裁剪功能（3种比例）
- ✅ 头像上传到 Supabase Storage
- ✅ **按技师ID分文件夹存储**
- ✅ 保持原图质量（无压缩）
- ✅ 用户绑定显示修复
- ✅ **用户绑定样式优化**
- ✅ 用户搜索功能增强
- ✅ 无 TypeScript 错误
- ✅ 所有依赖已安装

