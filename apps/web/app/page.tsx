import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/session";

export default async function RootPage() {
  const context = await getAuthContext();
  redirect(context?.activeProfile.interface === "simplified" ? "/portal" : "/dashboard");
}
