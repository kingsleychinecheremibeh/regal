import { AdminTicket } from "@/components/admin/ticket";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminTicket id={id} />;
}
