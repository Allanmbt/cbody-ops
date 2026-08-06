"use client"

import { Button } from "@/components/ui/button"

interface ListPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function ListPagination({ page, pageSize, total, onPageChange }: ListPaginationProps) {
  if (total <= pageSize) return null

  const pageCount = Math.ceil(total / pageSize)
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, total)

  return (
    <div className="flex flex-col gap-2 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{start}–{end} / {total}</span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>上一页</Button>
        <span className="min-w-16 text-center">{safePage} / {pageCount}</span>
        <Button variant="outline" size="sm" disabled={safePage === pageCount} onClick={() => onPageChange(safePage + 1)}>下一页</Button>
      </div>
    </div>
  )
}
