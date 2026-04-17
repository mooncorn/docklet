import PageHeader from "@/components/ui/PageHeader";
import UserList from "./UserList";
import { getSetting } from "@/lib/config";

export default function UsersPage() {
  let appName = "Docklet";
  try {
    appName = getSetting("app_name") ?? "Docklet";
  } catch {
    // DB unavailable at build time
  }
  return (
    <div>
      <PageHeader title="Users" description={`Manage ${appName} user accounts`} />
      <UserList />
    </div>
  );
}
