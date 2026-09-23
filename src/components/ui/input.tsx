import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldControlClass } from "@/components/ui/field";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(fieldControlClass, className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
