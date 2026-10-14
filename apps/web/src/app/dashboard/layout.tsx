import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await cookies()).toString();
  const api = (
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  ).replace(/\/$/, "");
  let user: { id: string; fullName: string; email: string } | null = null;
  try {
    const response = await fetch(`${api}/api/v1/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (response.ok) user = await response.json();
  } catch {
    /* A failed API lookup must never open the dashboard. */
  }
  if (!user) redirect("/sign-in?next=/dashboard");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
