"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className
      )}
      style={{
        background: "var(--ink)",
        color: "#ffffff",
      }}
    >
      <Star className="size-3.5" />
      PRO
    </span>
  );
}

export default ProBadge;

