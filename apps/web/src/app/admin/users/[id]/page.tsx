import { AdminUser } from "@/components/admin/user";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminUser id={id} />;
}
