import { redirect } from "next/navigation";

/**
 * The dashboard and the tracker were two readings of the same rows: a KPI wall in
 * one, the pipeline board in the other, both claiming to be the home screen.
 * Tracker is the source of truth now; the analytics it links to live at /analytics.
 * Old links, bookmarks and the `g d` chord keep working through this redirect.
 */
export default function DashboardPage() {
  redirect("/tracker");
}
