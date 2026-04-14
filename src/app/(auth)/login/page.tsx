import { redirect } from "next/navigation";
import { isSetupCompleted } from "@/lib/config";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isSetupCompleted()) {
    redirect("/setup");
  }
  return <LoginForm />;
}
