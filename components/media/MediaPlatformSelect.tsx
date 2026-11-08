'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MEDIA_PLATFORM_OPTIONS, type MediaPlatformScope } from '@/lib/features/media'

export function MediaPlatformSelect({ value, onChange, disabled }: {
    value: MediaPlatformScope
    onChange: (value: MediaPlatformScope) => void
    disabled?: boolean
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor="media-platform-scope">平台展示范围</Label>
            <Select value={value} onValueChange={(next) => onChange(next as MediaPlatformScope)} disabled={disabled}>
                <SelectTrigger id="media-platform-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {MEDIA_PLATFORM_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Web 始终可见，会员等级限制继续生效。</p>
        </div>
    )
}
