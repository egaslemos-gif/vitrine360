import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[0_6px_16px_rgba(112,87,220,0.28)] hover:bg-[var(--color-primary-hover)] hover:shadow-[0_8px_20px_rgba(112,87,220,0.36)]",
        secondary:
          "bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15",
        outline:
          "border border-[var(--color-border)] bg-white/80 shadow-[var(--shadow-subtle)] hover:bg-white",
        ghost: "hover:bg-[var(--color-muted)]",
        destructive:
          "bg-[var(--color-destructive)] text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-7 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
