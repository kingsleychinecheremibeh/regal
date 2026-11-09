import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";

export const metadata = { title: "Admin · TurboXGlobal" };

/** Every admin page is checked on the server before anything renders. */
export default async function AdminLayout({
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
  let me: { fullName: string; email: string; isAdmin?: boolean } | null = null;
  let status = 0;
  try {
    const response = await fetch(`${api}/api/v1/auth/me`, {
      headers: { cookie },
      cache: "no-store",
    });
    status = response.status;
    if (response.ok) me = await response.json();
  } catch {
    /* A failed API lookup must never open the admin area. */
  }
  if (!me) redirect(status === 401 ? "/sign-in?next=/admin" : "/sign-in");
  if (!me.isAdmin) redirect("/dashboard");
  return (
    <AdminShell name={me.fullName} email={me.email}>
      {children}
    </AdminShell>
  );
}
