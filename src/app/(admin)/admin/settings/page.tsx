import { requireOwner } from "@/lib/auth";
import { listOwners } from "@/lib/owners";
import { getSettingsForAdmin } from "@/lib/settingsAdmin";
import { SettingsForm } from "./SettingsForm";
import { ConnectionsCard } from "./ConnectionsCard";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { OwnersCard } from "./OwnersCard";
import "@/styles/admin-settings.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireOwner();
  const [settings, owners] = await Promise.all([getSettingsForAdmin(), listOwners(session.email)]);

  return (
    <SettingsForm
      settings={settings}
      connections={<ConnectionsCard />}
      changePassword={<ChangePasswordCard />}
      owners={<OwnersCard owners={owners} />}
    />
  );
}
