import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import UserList from "./UserList";
import { getSetting } from "@/lib/config";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  let session = null;
  let appName = "Docklet";
  try {
    session = await getSession();
    appName = getSetting("app_name") ?? "Docklet";
  } catch {
    // DB unavailable at build time
  }
  if (session && session.role !== "admin") {
    redirect("/containers");
  }
  return (
    <div>
      <PageHeader title="Users" description={`Manage ${appName} user accounts`} />
      <UserList />
    </div>
  );
}
