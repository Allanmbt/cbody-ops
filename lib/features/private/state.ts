import type { PrivateDataset, PrivateMutationAction } from "./types"

function upsert<T>(items: T[], value: T, matches: (item: T) => boolean): T[] {
  const index = items.findIndex(matches)
  if (index === -1) return [...items, value]
  return items.map((item, itemIndex) => (itemIndex === index ? value : item))
}

export function privateDataReducer(
  state: PrivateDataset,
  action: PrivateMutationAction
): PrivateDataset {
  switch (action.type) {
    case "UPSERT_PROFILE":
      return {
        ...state,
        profiles: upsert(state.profiles, action.value, (item) => item.girl_id === action.value.girl_id),
      }
    case "DELETE_PROFILE":
      return { ...state, profiles: state.profiles.filter((item) => item.girl_id !== action.girlId) }
    case "UPSERT_MEDIA": {
      const media = action.replaceActiveCover
        ? state.media.map((item) =>
            item.girl_id === action.value.girl_id && item.role === "cover" && item.is_active
              ? { ...item, is_active: false }
              : item
          )
        : state.media
      return { ...state, media: upsert(media, action.value, (item) => item.id === action.value.id) }
    }
    case "DELETE_MEDIA":
      return { ...state, media: state.media.filter((item) => item.id !== action.id) }
    case "UPSERT_ALBUM_SETTINGS":
      return {
        ...state,
        albumSettings: upsert(
          state.albumSettings,
          action.value,
          (item) => item.girl_id === action.value.girl_id
        ),
      }
    case "UPSERT_AVAILABILITY_SETTING":
      return {
        ...state,
        availabilitySettings: upsert(
          state.availabilitySettings,
          action.value,
          (item) => item.girl_id === action.value.girl_id
        ),
      }
    case "UPSERT_AVAILABILITY_SETTINGS_BATCH": {
      let availabilitySettings = state.availabilitySettings
      for (const value of action.values) {
        availabilitySettings = upsert(
          availabilitySettings,
          value,
          (item) => item.girl_id === value.girl_id
        )
      }
      return { ...state, availabilitySettings }
    }
    case "UPSERT_SERVICE_SETTING":
      return {
        ...state,
        serviceSettings: upsert(
          state.serviceSettings,
          action.value,
          (item) => item.service_id === action.value.service_id
        ),
      }
    case "DELETE_SERVICE_SETTING":
      return {
        ...state,
        serviceSettings: state.serviceSettings.filter((item) => item.service_id !== action.serviceId),
      }
    case "UPSERT_PROVIDER_SERVICE":
      return {
        ...state,
        providerServices: upsert(
          state.providerServices,
          action.value,
          (item) => item.admin_girl_service_id === action.value.admin_girl_service_id
        ),
        providerServiceAttires: [
          ...state.providerServiceAttires.filter(
            (item) => item.admin_girl_service_id !== action.value.admin_girl_service_id
          ),
          ...action.attireBindings,
        ],
      }
    case "DELETE_PROVIDER_SERVICE":
      return {
        ...state,
        providerServices: state.providerServices.filter(
          (item) => item.admin_girl_service_id !== action.adminGirlServiceId
        ),
        providerServiceAttires: state.providerServiceAttires.filter(
          (item) => item.admin_girl_service_id !== action.adminGirlServiceId
        ),
      }
    case "UPSERT_ATTIRE":
      return {
        ...state,
        attires: upsert(state.attires, action.value, (item) => item.id === action.value.id),
      }
    case "DELETE_ATTIRE":
      return {
        ...state,
        attires: state.attires.filter((item) => item.id !== action.id),
        providerServiceAttires: state.providerServiceAttires.filter((item) => item.attire_id !== action.id),
      }
    case "UPSERT_LOCATION":
      return {
        ...state,
        locations: upsert(state.locations, action.location, (item) => item.id === action.location.id),
        locationContent: action.content
          ? upsert(
              state.locationContent,
              action.content,
              (item) => item.incall_location_id === action.location.id
            )
          : state.locationContent.filter((item) => item.incall_location_id !== action.location.id),
      }
    case "DELETE_LOCATION":
      return {
        ...state,
        locations: state.locations.filter((item) => item.id !== action.id),
        locationContent: state.locationContent.filter((item) => item.incall_location_id !== action.id),
      }
  }
}
