import type { AdminRole } from "@/lib/types/admin"

export type LocalizedText = Record<string, string>
export type LocalizedList = Record<string, string[]>

export interface PrivateAuditFields {
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface PrivateGirl {
  id: string
  girl_number: number
  username: string
  name: string
  avatar_url: string | null
  incall_enabled: boolean
  incall_location_id: string | null
  is_verified: boolean
  is_blocked: boolean
  deleted_at: string | null
  category_names: string[]
}

export interface PrivateProfile extends PrivateAuditFields {
  girl_id: string
  introduction: LocalizedText
  bio: LocalizedText
  personal_tags: LocalizedList
  skin_tone: LocalizedText
  body_type: LocalizedText
  display_age: number | null
  badge: "hot" | "new" | "signature" | "vip" | null
  sort_order: number
  is_published: boolean
  health_certified: boolean
  booking_url: string
}

export interface PrivateAvailabilitySetting extends PrivateAuditFields {
  girl_id: string
  is_available: boolean
  start_time: string
  end_time: string
  ends_next_day: boolean
  note: LocalizedText
}

export interface PrivateMedia extends PrivateAuditFields {
  id: string
  girl_id: string
  kind: "image" | "video"
  role: "cover" | "gallery"
  url: string
  poster_url: string | null
  mime_type: string | null
  alt: LocalizedText
  sort_order: number
  is_active: boolean
}

export interface PrivateAlbumSettings extends PrivateAuditFields {
  girl_id: string
  background_audio_url: string | null
  background_audio_object_key: string | null
  background_audio_mime_type: string | null
  background_audio_title: string | null
  background_volume: number
  background_loop: boolean
  is_audio_enabled: boolean
  slide_duration_seconds: number
}

export interface BaseService {
  id: number
  code: string
  title: LocalizedText
  badge: string | null
  is_active: boolean
}

export interface PrivateServiceSetting extends PrivateAuditFields {
  service_id: number
  is_incall_enabled: boolean
  supports_attire: boolean
  display_category: "wellness" | "yoga" | "screening"
  name_override: LocalizedText
  description_override: LocalizedText
  sort_order: number
}

export interface AdminGirlService {
  id: string
  girl_id: string
  service_id: number
  is_qualified: boolean
  duration_minutes: number
  price: number
  duration_active: boolean
}

export interface PrivateProviderService extends PrivateAuditFields {
  admin_girl_service_id: string
  is_published: boolean
  sort_order: number
  badge: "popular" | "trending" | "new" | "signature" | "recommended" | null
  description_override: LocalizedText
  includes_override: LocalizedList
}

export interface PrivateAttire extends PrivateAuditFields {
  id: string
  code: string
  name: LocalizedText
  note: LocalizedText
  image_url: string
  sort_order: number
  is_active: boolean
}

export interface PrivateProviderServiceAttire extends PrivateAuditFields {
  admin_girl_service_id: string
  attire_id: string
  sort_order: number
  is_active: boolean
}

export interface IncallLocationMeta {
  floor?: string
  entrance_note?: string
  parking?: string
  [key: string]: unknown
}

export interface PrivateCity {
  id: number
  code: string
  name: LocalizedText
  display_name: string
}

export interface PrivateIncallLocation {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  place_id: string | null
  city_id: number | null
  city_name: string
  photos: string[]
  meta: IncallLocationMeta
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PrivateLocationContent extends PrivateAuditFields {
  incall_location_id: string
  public_name: LocalizedText
  district: LocalizedText
  is_published: boolean
}

export interface PrivateDataset {
  girls: PrivateGirl[]
  profiles: PrivateProfile[]
  availabilitySettings: PrivateAvailabilitySetting[]
  media: PrivateMedia[]
  albumSettings: PrivateAlbumSettings[]
  services: BaseService[]
  serviceSettings: PrivateServiceSetting[]
  adminGirlServices: AdminGirlService[]
  providerServices: PrivateProviderService[]
  attires: PrivateAttire[]
  providerServiceAttires: PrivateProviderServiceAttire[]
  cities: PrivateCity[]
  locations: PrivateIncallLocation[]
  locationContent: PrivateLocationContent[]
  capabilities: {
    albumSettings: boolean
    availabilitySettings: boolean
  }
}

export type PrivateMutationAction =
  | { type: "UPSERT_PROFILE"; value: PrivateProfile }
  | { type: "DELETE_PROFILE"; girlId: string }
  | { type: "UPSERT_MEDIA"; value: PrivateMedia; replaceActiveCover?: boolean }
  | { type: "DELETE_MEDIA"; id: string }
  | { type: "UPSERT_ALBUM_SETTINGS"; value: PrivateAlbumSettings }
  | { type: "UPSERT_AVAILABILITY_SETTING"; value: PrivateAvailabilitySetting }
  | { type: "UPSERT_AVAILABILITY_SETTINGS_BATCH"; values: PrivateAvailabilitySetting[] }
  | { type: "UPSERT_SERVICE_SETTING"; value: PrivateServiceSetting }
  | { type: "DELETE_SERVICE_SETTING"; serviceId: number }
  | {
      type: "UPSERT_PROVIDER_SERVICE"
      value: PrivateProviderService
      attireBindings: PrivateProviderServiceAttire[]
    }
  | { type: "DELETE_PROVIDER_SERVICE"; adminGirlServiceId: string }
  | { type: "UPSERT_ATTIRE"; value: PrivateAttire }
  | { type: "DELETE_ATTIRE"; id: string }
  | {
      type: "UPSERT_LOCATION"
      location: PrivateIncallLocation
      content: PrivateLocationContent | null
    }
  | { type: "DELETE_LOCATION"; id: string }

export type PrivateMutationDispatcher = (action: PrivateMutationAction) => void

export interface PrivatePagePermissions {
  role: AdminRole
  canManageContent: boolean
  canManageAvailability: boolean
  canDeleteAvailability: boolean
}

export type PrivateSection = "providers" | "availability" | "catalog" | "venues"
