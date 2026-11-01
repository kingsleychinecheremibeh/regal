import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";

export const metadata = { title: "Admin · TurboXGlobal" };

export default async function AdminPage() {
  const cookie = (await cookies()).toString();
  const api = (
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  ).replace(/\/$/, "");
  let status = 0;
  try {
    const response = await fetch(`${api}/api/v1/admin/overview`, {
      headers: { cookie },
      cache: "no-store",
    });
    status = response.status;
  } catch {
    /* A failed API lookup must never open the admin area. */
  }
  if (status === 403) redirect("/dashboard");
  if (status !== 200) redirect("/sign-in?next=/admin");
  return <AdminPanel />;
}
