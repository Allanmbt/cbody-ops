'use client'

import { Badge } from '@/components/ui/badge'

interface UserAdminTagsProps {
    tags?: string[] | null
    maxVisible?: number
    className?: string
}

export function UserAdminTags({ tags, maxVisible = 3, className }: UserAdminTagsProps) {
    const normalizedTags = (tags || [])
        .map((tag) => tag.trim())
        .filter(Boolean)

    if (normalizedTags.length === 0) {
        return null
    }

    const visibleTags = normalizedTags.slice(0, maxVisible)
    const hiddenCount = normalizedTags.length - visibleTags.length

    return (
        <div className={`inline-flex flex-wrap items-center gap-1 ${className || ''}`}>
            {visibleTags.map((tag) => (
                <Badge
                    key={tag}
                    variant="outline"
                    className="max-w-[96px] truncate border-amber-300 bg-amber-50 px-1.5 py-0 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    title={tag}
                >
                    {tag}
                </Badge>
            ))}
            {hiddenCount > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">
                    +{hiddenCount}
                </Badge>
            )}
        </div>
    )
}
