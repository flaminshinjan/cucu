import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-signal-100 text-signal-700 border border-signal-200",
        secondary: "bg-cream-200 text-ink-700 border border-ink-200/50",
        outline: "border border-ink-200/80 text-ink-500 bg-transparent",
        ink: "bg-ink-700 text-cream-50 border border-ink-700",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border border-amber-200",
        danger: "bg-red-50 text-red-700 border border-red-200",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
