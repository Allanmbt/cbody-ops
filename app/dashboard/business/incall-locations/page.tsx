import { redirect } from "next/navigation"

export default function LegacyIncallLocationsPage() {
  redirect("/dashboard/business/private?section=venues")
}
