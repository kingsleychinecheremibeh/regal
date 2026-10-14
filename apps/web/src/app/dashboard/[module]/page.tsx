import { notFound } from "next/navigation";
import { DashboardPanel } from "@/components/dashboard-panel";
import { modules } from "@/lib/dashboard-modules";
export function generateStaticParams() {
  return modules
    .filter((item) => item.slug !== "overview")
    .map((item) => ({ module: item.slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!modules.some((item) => item.slug === module)) notFound();
  return <DashboardPanel module={module} />;
}
