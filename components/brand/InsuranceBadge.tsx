"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export function InsuranceBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
      style={{
        borderColor: "var(--leaf-42a)",
        background: "color-mix(in oklab, var(--leaf-42a) 10%, var(--cloud))",
        color: "var(--ink)",
      }}
    >
      <ShieldCheck className="size-3.5" style={{ color: "var(--leaf-42a)" }} />
      Insured
    </span>
  );
}

export default InsuranceBadge;

