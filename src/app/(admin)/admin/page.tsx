import { redirect } from "next/navigation";

/**
 * `/admin/products` is the admin home now — the counts and setup checklist
 * that used to live here moved to `/admin/settings` (the setup checklist)
 * or away entirely (the orders-to-fulfil counts). This route stays only so
 * old links and the wordmark's `href` keep working.
 */
export default function AdminDashboardPage() {
  redirect("/admin/products");
}
