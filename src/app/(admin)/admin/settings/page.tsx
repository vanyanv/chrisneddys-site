import { getSettingsForAdmin } from "@/lib/settingsAdmin";
import { SettingsForm } from "./SettingsForm";
import { ConnectionsCard } from "./ConnectionsCard";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettingsForAdmin();

  return (
    <>
      <h1 className="adm-h1">Settings</h1>
      <div className="adm-editor-grid">
        <div className="adm-editor-left">
          <SettingsForm settings={settings} />
        </div>
        <div className="adm-editor-right">
          <ConnectionsCard />
        </div>
      </div>
    </>
  );
}
