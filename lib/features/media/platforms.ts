import type { MediaPlatformVisibility } from './types'

export const MEDIA_PLATFORM_OPTIONS = [
    { value: 'all', label: '全部平台（iOS＋Android＋Web）' },
    { value: 'android_web', label: 'Android＋Web（iOS 不显示）' },
    { value: 'web', label: '仅 Web（App 均不显示）' },
] as const

export type MediaPlatformScope = typeof MEDIA_PLATFORM_OPTIONS[number]['value']

export function getMediaPlatformScope(visibility: Partial<MediaPlatformVisibility>): MediaPlatformScope {
    if (visibility.visible_on_android === false) return 'web'
    return visibility.visible_on_ios === false ? 'android_web' : 'all'
}

export function getMediaPlatformLabel(visibility: Partial<MediaPlatformVisibility>): string {
    return MEDIA_PLATFORM_OPTIONS.find(option => option.value === getMediaPlatformScope(visibility))!.label
}

export function buildMediaPlatformVisibility(scope: MediaPlatformScope): MediaPlatformVisibility {
    return { visible_on_ios: scope === 'all', visible_on_android: scope !== 'web' }
}

export function getMediaPlatformPatch(visibility: Partial<MediaPlatformVisibility>): Partial<MediaPlatformVisibility> {
    return visibility.visible_on_ios === undefined ? {} : {
        visible_on_ios: visibility.visible_on_ios,
        visible_on_android: visibility.visible_on_android,
    }
}
