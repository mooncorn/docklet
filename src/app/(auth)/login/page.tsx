import { redirect } from "next/navigation";
import { isSetupCompleted } from "@/lib/config";
import { getSession } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isSetupCompleted()) {
    redirect("/setup");
  }
  const session = await getSession();
  if (session) {
    redirect("/containers");
  }
  return <LoginForm />;
}
