# CBODY Private 混合相册前端对接说明

## 目标

每名开启 Incall 的 Private 技师维护 1–5 项混合媒体，支持静态照片、3–6 秒左右的动态照片和整套相册共用的独立背景音乐。

动态照片在数据库中按短视频处理，不实现或新增 Apple Live Photo 专有格式。

## 数据来源

混合相册由两张表组成：

- `private_media`：保存静态照片、动态照片、poster、封面角色和排序。
- `private_album_settings`：保存该技师整套相册共用的背景音乐和轮播设置。

两张表均通过 `girl_id` 关联 `girls.id`。不要使用展示工号 `girls.girl_number` 作为关联 ID。

## private_media 使用规则

| 场景 | 字段值 |
|------|--------|
| 静态照片 | `kind='image'`，图片地址写入 `url`，`poster_url=NULL` |
| 动态照片 | `kind='video'`，无声短视频写入 `url`，封面图写入 `poster_url` |
| 相册主封面 | `role='cover'` |
| 普通相册项目 | `role='gallery'` |
| 展示顺序 | 按 `sort_order ASC, id ASC` |
| 是否展示 | 仅展示 `is_active=true` |

约束：

- 每名技师前端最多展示 5 项启用媒体。
- 每名技师最多一项启用状态的 `cover`。
- `kind='video'` 时 `poster_url` 必填。
- `url` 和 `poster_url` 必须为 HTTPS URL。
- 不新增 `live_photo`、`motion_photo` 等媒体类型。

## private_album_settings 字段

| 字段 | 前端用途 |
|------|----------|
| `girl_id` | 技师 UUID，一对一主键 |
| `background_audio_url` | 背景音乐播放地址 |
| `background_audio_object_key` | R2 后台对象路径；禁止输出到公开前端 |
| `background_audio_mime_type` | `<audio>` source MIME |
| `background_audio_title` | 音乐名称或播放器提示 |
| `background_volume` | 默认音量，0–1，默认 0.35 |
| `background_loop` | 是否循环播放 |
| `is_audio_enabled` | 是否允许前端展示音乐入口 |
| `slide_duration_seconds` | 静态照片自动切换时间，3–10 秒 |

只有同时满足以下条件时才展示背景音乐入口：

```text
is_audio_enabled = true
并且 background_audio_url 非空
```

## 建议的公开数据结构

公开前端不应直接查询 `private_media` 或 `private_album_settings`，应通过现有 Private `SECURITY DEFINER` RPC 获得经过过滤的安全数据。

建议 RPC 为单个技师返回：

```ts
interface PrivateAlbum {
  items: Array<{
    id: string
    kind: "image" | "video"
    role: "cover" | "gallery"
    url: string
    posterUrl: string | null
    mimeType: string | null
    alt: string
    sortOrder: number
  }>
  audio: {
    enabled: boolean
    url: string | null
    mimeType: string | null
    title: string | null
    volume: number
    loop: boolean
  }
  slideDurationSeconds: number
}
```

公开 RPC 禁止返回：

- `background_audio_object_key`
- `created_by`、`updated_by`
- `created_at`、`updated_at`
- 停用媒体或停用音乐设置

当前 RLS 不允许 anon 直接读取任何 Private 原始表。如果现有 RPC 尚未返回 `private_album_settings`，必须先由后端安全地扩展 RPC，前端不能绕过 RLS 直接查询。

## 播放交互

- 相册使用 4:5 竖版容器。
- 静态照片按 `slide_duration_seconds` 自动切换。
- 动态照片只在当前相册页播放，使用 `muted`、`loop`、`playsInline`。
- 离开当前页后暂停视频，避免多个视频同时解码。
- 背景音乐属于整个相册，切换图片或动态照片时不要重新开始。
- 浏览器通常禁止有声自动播放，因此首次播放音乐必须由用户点击“开启音乐”。
- 页面隐藏、相册关闭或技师详情退出时暂停音乐和视频。

## 文件建议

- 静态照片：4:5，建议 1080×1350，WebP/JPEG。
- 动态照片：3–6 秒，4:5，H.264 MP4，24/30 FPS，无声，必须有 poster。
- 背景音乐：AAC/M4A 或 MP3，建议 20–30 秒可无缝循环。
- 文件建议存放在 Cloudflare R2，Supabase 只保存 URL、排序、状态和关系数据。

当前 ops 管理仅维护已上传完成的 HTTPS URL，真实上传、转码、压缩和删除 R2 文件属于后续上传服务范围。

## 权限

- `superadmin/admin`：读取和管理媒体及相册设置。
- `support`：只读媒体及相册设置。
- `finance`、普通用户、技师本人：不能直接读取或修改原始表。
- `anon`：只能通过公开 Private RPC 获取过滤后的安全数据。
