"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { colors, shadows, gradients } from "@/lib/design-tokens";

export interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "glass" | "elevated" | "bordered" | "accent";
  hoverable?: boolean;
  shadowSize?: "none" | "sm" | "md" | "lg";
  withGradientBackground?: boolean;
  withGradientBorder?: boolean;
}

export const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ 
    children, 
    className, 
    variant = "default", 
    hoverable = false,
    shadowSize = "md",
    withGradientBackground = false,
    withGradientBorder = false,
    ...props 
  }, ref) => {
    const variantStyles = {
      default: "bg-[#111111] border border-[#222222]",
      subtle: "bg-[#0A0A0A] border border-[#1D1D1D]",
      glass: "backdrop-blur-md bg-[rgba(17,17,17,0.7)] border border-[rgba(34,34,34,0.7)]",
      elevated: "bg-[#111111] border border-[#333333]",
      bordered: "bg-[#0D0D0D] border-2 border-[#333333]",
      accent: "bg-[#111111] border border-[#B4916C]"
    };

    const shadowStyles = {
      none: "",
      sm: "shadow-sm",
      md: "shadow-md",
      lg: "shadow-lg"
    };

    const hoverStyles = hoverable 
      ? "transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg" 
      : "";

    const gradientBg = withGradientBackground
      ? `before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-[#161616] before:to-[#0A0A0A] before:opacity-80 before:content-[''] before:z-0`
      : "";

    const gradientBorder = withGradientBorder
      ? "p-[1px] bg-gradient-to-br from-[#333333] via-[#B4916C] to-[#333333] rounded-xl"
      : "";

    return (
      <div className={cn(gradientBorder)}>
        <div
          ref={ref}
          className={cn(
            "relative rounded-xl overflow-hidden",
            gradientBg,
            variantStyles[variant],
            shadowStyles[shadowSize],
            hoverStyles,
            withGradientBorder ? "rounded-[calc(0.75rem-1px)]" : "",
            className
          )}
          {...props}
        >
          <div className="relative z-10">{children}</div>
        </div>
      </div>
    );
  }
);
PremiumCard.displayName = "PremiumCard";

export interface PremiumCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  withSeparator?: boolean;
}

export const PremiumCardHeader = React.forwardRef<HTMLDivElement, PremiumCardHeaderProps>(
  ({ className, withSeparator = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col space-y-1.5 p-6", 
        withSeparator && "border-b border-[#1A1A1A]",
        className
      )}
      {...props}
    />
  )
);
PremiumCardHeader.displayName = "PremiumCardHeader";

export const PremiumCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-safiro font-medium tracking-tight text-[#F9F6EE]",
      className
    )}
    {...props}
  />
));
PremiumCardTitle.displayName = "PremiumCardTitle";

export const PremiumCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#C5C2BA] font-borna", className)}
    {...props}
  />
));
PremiumCardDescription.displayName = "PremiumCardDescription";

export const PremiumCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0", className)}
    {...props}
  />
));
PremiumCardContent.displayName = "PremiumCardContent";

export const PremiumCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-6 pt-0",
      className
    )}
    {...props}
  />
));
PremiumCardFooter.displayName = "PremiumCardFooter"; 