import PageHeader from "@/components/ui/PageHeader";
import UserList from "./UserList";

export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Users" description="Manage Docklet user accounts" />
      <UserList />
    </div>
  );
}
