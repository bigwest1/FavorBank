"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function BrandBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        "border-[--leaf-42a] text-foreground bg-cloud/60 backdrop-blur",
        className
      )}
      style={{
        // ensure AAA contrast by using ink text on cloud background
        color: "var(--ink)",
        background: "var(--cloud)",
      }}
    >
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ background: "var(--leaf-42a)" }}
      />
      FavorBank
    </span>
  );
}

export default BrandBadge;

