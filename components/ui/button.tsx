"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: ink-on-cream with a coral underline-shadow that lifts on hover.
        default:
          "bg-ink-700 text-cream-50 shadow-[inset_0_-2px_0_rgba(0,0,0,0.3),0_8px_20px_-12px_rgba(242,64,22,0.45)] hover:bg-ink-800 hover:-translate-y-px active:translate-y-0",
        // Coral CTA when we want to scream "primary action"
        coral:
          "bg-signal-500 text-white shadow-[0_8px_24px_-10px_rgba(242,64,22,0.65)] hover:bg-signal-600 hover:-translate-y-px active:translate-y-0",
        outline:
          "border border-ink-200 bg-card text-ink-700 hover:border-ink-400 hover:bg-cream-100",
        ghost: "text-ink-600 hover:bg-cream-100 hover:text-ink-800",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-cream-200/60",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
