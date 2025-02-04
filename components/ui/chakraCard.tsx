import * as React from "react"
import { cn } from "@/lib/utils"

const ChakraCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-[#584235] bg-[#2C2420]/80 backdrop-blur-sm text-card-foreground shadow-xl hover:shadow-2xl transition-all duration-300",
      className
    )}
    {...props}
  />
))
ChakraCard.displayName = "ChakraCard"

const ChakraCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-8", className)}
    {...props}
  />
))
ChakraCardHeader.displayName = "ChakraCardHeader"

const ChakraCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight text-[#E8DCC4]", className)}
    {...props}
  />
))
ChakraCardTitle.displayName = "ChakraCardTitle"

const ChakraCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[#B4916C]", className)}
    {...props}
  />
))
ChakraCardDescription.displayName = "ChakraCardDescription"

const ChakraCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-8 pt-0", className)} {...props} />
))
ChakraCardContent.displayName = "ChakraCardContent"

const ChakraCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-8 pt-0", className)}
    {...props}
  />
))
ChakraCardFooter.displayName = "ChakraCardFooter"

export { 
  ChakraCard, 
  ChakraCardHeader, 
  ChakraCardFooter, 
  ChakraCardTitle, 
  ChakraCardDescription, 
  ChakraCardContent 
}
