import { notFound } from "next/navigation";
import { ModuleView } from "@/components/dashboard/module-view";
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
  return <ModuleView module={module} />;
}
