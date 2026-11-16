import AuthEntry from "@/components/auth/AuthEntry";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; audience?: string }> }) {
  const params = await searchParams;
  return <AuthEntry initialView={params.mode === "register" ? "register" : "signin"} initialAudience={params.audience === "staff" ? "staff" : "patient"} />;
}
