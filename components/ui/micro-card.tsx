// components/ui/micro-card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const MicroCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "gradient" | "glass" }
>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default:
      "rounded-full border border-[#584235] bg-[#2C2420] backdrop-blur-sm text-card-foreground shadow-xl hover:shadow-2xl transition-all duration-300 h-10 w-10",
    gradient:
      "rounded-full bg-gradient-to-br from-[#584235] via-[#2C2420] to-[#1A1614] border border-[#B4916C] shadow-lg hover:shadow-2xl transition-all duration-300 h-10 w-10",
    glass:
      "rounded-full bg-white backdrop-blur-lg border border-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:bg-white h-10 w-10",
  };

  return <div ref={ref} className={cn(variants[variant], className)} {...props} />;
});
MicroCard.displayName = "MicroCard";

export { MicroCard };
