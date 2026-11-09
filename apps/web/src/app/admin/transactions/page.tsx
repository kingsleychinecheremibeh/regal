import { Suspense } from "react";
import { AdminTransactions } from "@/components/admin/transactions";

export default function Page() {
  return (
    <Suspense fallback={<p className="mut">Loading…</p>}>
      <AdminTransactions />
    </Suspense>
  );
}
