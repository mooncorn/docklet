import PageHeader from "@/components/ui/PageHeader";
import UserList from "./UserList";
import { getSetting } from "@/lib/config";

export default function UsersPage() {
  const appName = getSetting("app_name") ?? "Docklet";
  return (
    <div>
      <PageHeader title="Users" description={`Manage ${appName} user accounts`} />
      <UserList />
    </div>
  );
}
