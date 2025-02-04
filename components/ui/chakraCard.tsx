import * as React from "react"
import { cn } from "@/lib/utils"

const ChakraCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'gradient' | 'glass' | 'figma-hero'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: "rounded-lg border border-[#584235] bg-[#2C2420]/80 backdrop-blur-sm text-card-foreground shadow-xl hover:shadow-2xl transition-all duration-300",
    gradient: "rounded-lg bg-gradient-to-br from-[#584235] via-[#2C2420] to-[#1A1614] border border-[#B4916C]/20 shadow-lg hover:shadow-2xl transition-all duration-300",
    glass: "rounded-lg bg-white/5 backdrop-blur-lg border border-white/10 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:bg-white/10",
    'figma-hero': "relative bg-gradient-to-br from-[#1A1614] via-[#2C2420] to-[#584235] transform rotate-45 aspect-square w-[800px] mx-auto overflow-hidden shadow-2xl",
    hero: "rounded-[32px] bg-gradient-to-br from-[#1A1614] via-[#2C2420] to-[#584235] border-2 border-[#B4916C]/30 shadow-2xl p-8 mx-4 md:mx-auto max-w-7xl w-full"
  }

  return (
    <div
      ref={ref}
      className={cn(
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
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
