"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        aria-hidden
        className="h-6 w-6 rounded-md"
        style={{
          background:
            "conic-gradient(from 220deg, var(--leaf-42a), var(--citrus), var(--leaf-42a))",
        }}
      />
      <span className="font-[family:var(--font-inter-display)] text-base font-semibold tracking-tight text-foreground">
        FavorBank
      </span>
    </div>
  );
}

export default Logo;

