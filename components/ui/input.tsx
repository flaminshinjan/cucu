import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 transition-colors",
        "placeholder:text-ink-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-200 focus-visible:border-signal-400",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 transition-colors resize-none",
      "placeholder:text-ink-300",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-200 focus-visible:border-signal-400",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
