import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const hasAuth = cookieStore.has("refresh_token") || cookieStore.has("access_token");
  if (hasAuth) {
    redirect("/dashboard");
  }
  redirect("/browse");
}