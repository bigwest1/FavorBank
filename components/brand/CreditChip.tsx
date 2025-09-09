"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

type Props = {
  amount: number | string;
  className?: string;
};

export function CreditChip({ amount, className }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "springy inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold shadow-sm",
        "border-border bg-white text-foreground dark:bg-card/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--leaf-42a]/50",
        className
      )}
      style={{
        borderColor: "var(--leaf-42a)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.05), inset 0 -1px 0 rgba(0,0,0,0.04)",
      }}
    >
      <Coins className="size-4" style={{ color: "var(--leaf-42a)" }} />
      <span>{amount}</span>
    </button>
  );
}

export default CreditChip;

