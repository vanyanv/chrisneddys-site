import { getSettingsForAdmin } from "@/lib/settingsAdmin";
import { SettingsForm } from "./SettingsForm";
import { ConnectionsCard } from "./ConnectionsCard";
import "@/styles/admin-settings.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettingsForAdmin();

  return <SettingsForm settings={settings} connections={<ConnectionsCard />} />;
}
