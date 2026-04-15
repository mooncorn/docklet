import PageHeader from "@/components/ui/PageHeader";
import DashboardStats from "./DashboardStats";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Host and Docker at a glance" />
      <DashboardStats />
    </div>
  );
}
