"use client"

import * as React from "react"

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-gray-200 ${
          orientation === "horizontal" 
            ? "h-px w-full" 
            : "w-px h-full"
        } ${className}`}
        {...props}
      />
    )
  }
)
Separator.displayName = "Separator"

export { Separator }