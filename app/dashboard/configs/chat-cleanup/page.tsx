"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading"
import { Badge } from "@/components/ui/badge"
import { Trash2, AlertTriangle, Database, Image as ImageIcon, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  getChatCleanupStats,
  deleteSingleThread,
  cleanupOldMessages,
  cleanupInvalidThreads
} from "./actions"
import type { ChatCleanupStats } from "@/lib/features/chat-cleanup"

export default function ChatCleanupPage() {
  const [stats, setStats] = useState<ChatCleanupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [threadId, setThreadId] = useState('')
  const [deletingThread, setDeletingThread] = useState(false)

  const [cleaningOld, setCleaningOld] = useState(false)
  const [cleaningInvalid, setCleaningInvalid] = useState(false)

  // 加载统计数据
  const loadStats = async () => {
    try {
      setRefreshing(true)
      const result = await getChatCleanupStats()
      if (result.ok) {
        setStats(result.data)
      } else {
        toast.error(result.error || '加载统计失败')
      }
    } catch (error) {
      console.error('加载统计失败:', error)
      toast.error('加载统计失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  // 删除单条线程
  const handleDeleteThread = async () => {
    if (!threadId.trim()) {
      toast.error('请输入线程ID')
      return
    }

    if (!confirm(`确定要删除线程 ${threadId} 吗？\n\n此操作将删除：\n- 该线程的所有聊天消息\n- 该线程的所有图片文件\n- 该线程的已读记录\n\n此操作不可逆，请谨慎操作！`)) {
      return
    }

    setDeletingThread(true)
    try {
      const result = await deleteSingleThread(threadId)
      if (result.ok) {
        toast.success(`删除成功！删除了 ${result.data.deleted_messages} 条消息，${result.data.deleted_images} 张图片`)
        setThreadId('')
        loadStats() // 刷新统计
      } else {
        toast.error(result.error || '删除失败')
      }
    } catch (error) {
      console.error('删除线程失败:', error)
      toast.error('删除线程失败')
    } finally {
      setDeletingThread(false)
    }
  }

  // 批量清理超过90天的消息
  const handleCleanupOld = async () => {
    if (!stats || stats.old_messages_count === 0) {
      toast.info('没有需要清理的旧消息')
      return
    }

    if (!confirm(`确定要清理超过90天的聊天记录吗？\n\n将删除：\n- ${stats.old_messages_count} 条消息\n- ${stats.old_images_count} 张图片文件\n\n此操作不可逆，请谨慎操作！`)) {
      return
    }

    setCleaningOld(true)
    try {
      const result = await cleanupOldMessages()
      if (result.ok) {
        toast.success(`清理成功！删除了 ${result.data.deleted_count} 条消息，${result.data.deleted_images_count} 张图片`)
        loadStats() // 刷新统计
      } else {
        toast.error(result.error || '清理失败')
      }
    } catch (error) {
      console.error('清理旧消息失败:', error)
      toast.error('清理旧消息失败')
    } finally {
      setCleaningOld(false)
    }
  }

  // 批量清理无效线程
  const handleCleanupInvalid = async () => {
    if (!stats || stats.invalid_threads_count === 0) {
      toast.info('没有需要清理的无效线程')
      return
    }

    if (!confirm(`确定要清理无效线程吗？\n\n将删除：\n- ${stats.invalid_threads_count} 个无效线程（无已完成订单且超过3天）\n- 及其所有聊天消息和图片文件\n\n此操作不可逆，请谨慎操作！`)) {
      return
    }

    setCleaningInvalid(true)
    try {
      const result = await cleanupInvalidThreads()
      if (result.ok) {
        toast.success(`清理成功！删除了 ${result.data.deleted_count} 个线程，${result.data.deleted_images_count} 张图片`)
        loadStats() // 刷新统计
      } else {
        toast.error(result.error || '清理失败')
      }
    } catch (error) {
      console.error('清理无效线程失败:', error)
      toast.error('清理无效线程失败')
    } finally {
      setCleaningInvalid(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">聊天记录清理</h1>
          <p className="text-muted-foreground mt-2">
            管理和清理系统聊天记录，释放存储空间
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStats}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新统计
        </Button>
      </div>

      {/* 警告提示 */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>重要提示：</strong>所有清理操作不可逆，请谨慎操作！删除前请确认数据已备份。
        </AlertDescription>
      </Alert>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              无效线程统计
            </CardTitle>
            <CardDescription>
              无已完成订单且超过3天的线程
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.invalid_threads_count || 0}
              <span className="text-base font-normal text-muted-foreground ml-2">个线程</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              超过90天的消息
            </CardTitle>
            <CardDescription>
              包含消息文本和图片文件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stats?.old_messages_count || 0}</span>
                <span className="text-base text-muted-foreground">条消息</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-orange-600">{stats?.old_images_count || 0}</span>
                <span className="text-base text-muted-foreground">张图片</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作区域 */}
      <div className="grid gap-6 md:grid-cols-1">
        {/* 删除单条线程 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              删除单条线程
            </CardTitle>
            <CardDescription>
              通过线程ID删除指定线程及其所有聊天记录、图片文件和已读记录
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thread-id">线程 ID</Label>
              <Input
                id="thread-id"
                placeholder="请输入线程UUID，例如：00000000-0000-0000-0000-000000000000"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                disabled={deletingThread}
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteThread}
              disabled={!threadId.trim() || deletingThread}
            >
              {deletingThread ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除线程
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 批量清理超过90天的消息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-600" />
              批量清理超过90天的聊天记录
            </CardTitle>
            <CardDescription>
              删除所有超过90天的聊天消息和图片文件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">待清理数据</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stats?.old_messages_count || 0} 条消息，{stats?.old_images_count || 0} 张图片
                </div>
              </div>
              {stats && stats.old_messages_count > 0 ? (
                <Badge variant="destructive">需要清理</Badge>
              ) : (
                <Badge variant="secondary">无需清理</Badge>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={handleCleanupOld}
              disabled={!stats || stats.old_messages_count === 0 || cleaningOld}
            >
              {cleaningOld ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  清理中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  批量清理旧消息
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 批量清理无效线程 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-purple-600" />
              批量清理无效线程
            </CardTitle>
            <CardDescription>
              删除无已完成订单且超过3天的线程及其所有数据
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">待清理线程</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stats?.invalid_threads_count || 0} 个无效线程
                </div>
              </div>
              {stats && stats.invalid_threads_count > 0 ? (
                <Badge variant="destructive">需要清理</Badge>
              ) : (
                <Badge variant="secondary">无需清理</Badge>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={handleCleanupInvalid}
              disabled={!stats || stats.invalid_threads_count === 0 || cleaningInvalid}
            >
              {cleaningInvalid ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  清理中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  批量清理无效线程
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 说明提示 */}
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/20">
              <AlertTriangle className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">清理说明</h3>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>删除线程会自动级联删除该线程的所有消息和已读记录</li>
                <li>删除消息会同时删除存储桶中对应的图片文件</li>
                <li>无效线程指：顾客与技师无任何已完成订单，且线程创建时间超过3天</li>
                <li>所有清理操作会记录审计日志，可在系统日志中查看</li>
                <li>建议在系统负载较低时执行批量清理操作</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
