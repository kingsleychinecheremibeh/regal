import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-13 w-full rounded-xl border border-white/20 bg-[#0a2538] px-4 text-white outline-none placeholder:text-[#91a4ae] focus:border-[#72b7ae] focus:ring-2 focus:ring-[#72b7ae]/25 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
