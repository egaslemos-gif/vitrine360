import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Icon-only button — requires aria-label for accessibility.
 */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "size" | "children"> & {
    "aria-label": string;
    children: React.ReactNode;
  }
>(({ className, children, ...props }, ref) => (
  <Button
    ref={ref}
    size="icon"
    variant={props.variant ?? "ghost"}
    className={cn("shrink-0", className)}
    {...props}
  >
    {children}
  </Button>
));
IconButton.displayName = "IconButton";
