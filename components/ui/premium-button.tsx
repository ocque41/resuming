"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B4916C] focus-visible:ring-offset-1 focus-visible:ring-offset-[#050505] disabled:pointer-events-none disabled:opacity-50 font-borna relative overflow-hidden transform",
  {
    variants: {
      variant: {
        default:
          "bg-[#B4916C] text-[#050505] hover:bg-[#C5A280] active:bg-[#A38160] shadow-sm",
        destructive:
          "bg-[#1A0505] text-[#F5C2C2] border border-[#3D1A1A] hover:bg-[#2a0d0d] hover:text-[#f9d1d1]",
        outline:
          "border border-[#333333] bg-transparent text-[#F9F6EE] hover:bg-[#111111] hover:border-[#444444]",
        secondary:
          "bg-[#222222] text-[#F9F6EE] hover:bg-[#333333]",
        ghost:
          "text-[#F9F6EE] hover:bg-[#111111] hover:text-[#F9F6EE]",
        link:
          "text-[#B4916C] underline-offset-4 hover:underline hover:text-[#C5A280]",
        premium:
          "text-[#050505] shadow-md before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#B4916C] before:to-[#C5A280] before:z-0 hover:before:translate-x-[-5%] hover:before:scale-x-110 before:transition-transform before:duration-300",
        glass:
          "backdrop-blur-md bg-[rgba(17,17,17,0.6)] border border-[rgba(34,34,34,0.7)] text-[#F9F6EE] hover:bg-[rgba(26,26,26,0.8)] hover:border-[rgba(51,51,51,0.8)]",
        gradient:
          "border border-[#222222] text-[#F9F6EE] bg-gradient-to-r from-[#111111] to-[#0A0A0A] hover:from-[#161616] hover:to-[#0D0D0D]",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 rounded-md px-2.5 text-xs",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        xl: "h-12 rounded-xl px-10 text-lg",
        icon: "h-9 w-9",
      },
      withRing: {
        true: "ring-1 ring-[#333333]",
        false: "",
      },
      isGlowing: {
        true: "animate-glow",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      withRing: false,
      isGlowing: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  withShine?: boolean;
}

const PremiumButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    withRing,
    isGlowing,
    asChild = false, 
    isLoading = false,
    loadingText,
    withShine = false,
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Add a shine effect on hover - moving gradient
    const shineEffect = withShine ? (
      <span 
        className="absolute inset-0 h-full w-[100px] translate-x-[-100%] rotate-[30deg] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent transform transition-all duration-1500 group-hover:translate-x-[200%]" 
        aria-hidden="true" 
      />
    ) : null;
    
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, withRing, isGlowing, className }),
          withShine && "group",
          isLoading && "pointer-events-none"
        )}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {withShine && shineEffect}
        
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin relative z-10" />
            <span className="relative z-10">{loadingText || "Loading..."}</span>
          </>
        ) : (
          <span className="relative z-10">{children}</span>
        )}
      </Comp>
    );
  }
);
PremiumButton.displayName = "PremiumButton";

export { PremiumButton, buttonVariants }; 