"use client"

import { useState } from "react"
import { MapPin, ExternalLink, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { toggleIncallLocationStatus, deleteIncallLocation } from "@/app/dashboard/business/incall-locations/actions"
import type { IncallLocation } from "@/lib/features/incall-locations"

interface IncallLocationTableProps {
  locations: IncallLocation[]
  loading: boolean
  onRefresh: () => void
  onEdit: (loc: IncallLocation) => void
}

function getCityName(city?: IncallLocation["city"]) {
  if (!city) return "—"
  return city.name?.zh || city.name?.en || city.code
}

function getMapsUrl(loc: IncallLocation) {
  if (loc.place_id) return `https://www.google.com/maps/place/?q=place_id:${loc.place_id}`
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
}

function PhotoPreview({ photos, initialIndex, onClose }: {
  photos: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white disabled:opacity-30"
            onClick={(e) => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)) }}
            disabled={idx === 0}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white disabled:opacity-30"
            onClick={(e) => { e.stopPropagation(); setIdx(i => Math.min(photos.length - 1, i + 1)) }}
            disabled={idx === photos.length - 1}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[idx]}
        alt=""
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-md"
        onClick={(e) => e.stopPropagation()}
      />
      {photos.length > 1 && (
        <div className="absolute bottom-4 text-white/60 text-sm">
          {idx + 1} / {photos.length}
        </div>
      )}
    </div>
  )
}

export function IncallLocationTable({
  locations,
  loading,
  onRefresh,
  onEdit,
}: IncallLocationTableProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<IncallLocation | null>(null)
  const [preview, setPreview] = useState<{ photos: string[]; index: number } | null>(null)

  const handleToggle = async (id: string, currentActive: boolean) => {
    setTogglingId(id)
    try {
      const result = await toggleIncallLocationStatus(id)
      if (result.ok) {
        toast.success(currentActive ? "已停用地址" : "已激活地址")
        onRefresh()
      } else {
        toast.error(result.error || "操作失败")
      }
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    setConfirmDelete(null)
    try {
      const result = await deleteIncallLocation(confirmDelete.id)
      if (result.ok) {
        toast.success("地址已删除")
        onRefresh()
      } else {
        toast.error(result.error || "删除失败")
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MapPin className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">暂无到店地址</p>
      </div>
    )
  }

  return (
    <>
      {preview && (
        <PhotoPreview
          photos={preview.photos}
          initialIndex={preview.index}
          onClose={() => setPreview(null)}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将删除地址「{confirmDelete?.name}」及其所有图片，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">地点名称</TableHead>
              <TableHead className="min-w-[200px]">地址</TableHead>
              <TableHead className="w-[100px]">城市</TableHead>
              <TableHead className="w-[100px]">图片</TableHead>
              <TableHead className="w-[80px]">坐标</TableHead>
              <TableHead className="w-[120px]">创建时间</TableHead>
              <TableHead className="w-[90px] text-center">状态</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((loc) => (
              <TableRow key={loc.id} className={deletingId === loc.id ? "opacity-50" : ""}>
                <TableCell>
                  <div className="font-medium text-sm leading-snug">{loc.name}</div>
                  {loc.meta?.floor && (
                    <div className="text-xs text-muted-foreground mt-0.5">{loc.meta.floor}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground line-clamp-2">{loc.address}</div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{getCityName(loc.city)}</span>
                </TableCell>
                <TableCell>
                  {loc.photos?.length > 0 ? (
                    <div className="flex gap-1">
                      {loc.photos.slice(0, 3).map((url, i) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setPreview({ photos: loc.photos, index: i })}
                          className="relative w-8 h-8 rounded overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {i === 2 && loc.photos.length > 3 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-medium">
                              +{loc.photos.length - 3}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={getMapsUrl(loc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    地图
                  </a>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {new Date(loc.created_at).toLocaleDateString("zh-CN")}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={togglingId === loc.id}
                    onClick={() => handleToggle(loc.id, loc.is_active)}
                    className="h-7 px-2 gap-1"
                  >
                    {loc.is_active ? (
                      <ToggleRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant={loc.is_active ? "default" : "secondary"} className="text-xs px-1.5 py-0">
                      {loc.is_active ? "激活" : "停用"}
                    </Badge>
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(loc)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDelete(loc)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
