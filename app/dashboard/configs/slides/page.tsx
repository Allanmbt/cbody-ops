import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SlidesManager } from '@/components/slides/SlidesManager'
import { getHomeSlides } from './actions'

export default async function SlidesPage() {
    try { await requireAdmin(['superadmin', 'admin']) } catch { redirect('/login') }
    const result = await getHomeSlides()
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">首页幻灯片</h1>
                    <p className="mt-2 text-sm text-muted-foreground">最多 3 张，按位置顺序展示。全部删除后，客户端隐藏此区域。</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/configs">返回配置</Link></Button>
            </div>
            {result.ok ? <SlidesManager initialSlides={result.data} /> : (
                <Alert variant="destructive"><AlertTitle>幻灯片加载失败</AlertTitle><AlertDescription>{result.error}</AlertDescription></Alert>
            )}
        </div>
    )
}
