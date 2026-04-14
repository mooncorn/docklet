import { redirect } from "next/navigation";
import { isSetupCompleted } from "@/lib/config";
import { getSession } from "@/lib/auth/session";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (isSetupCompleted()) {
    const session = await getSession();
    redirect(session ? "/containers" : "/login");
  }
  return <SetupForm />;
}
