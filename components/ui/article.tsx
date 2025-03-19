"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

interface ArticleProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

export function Article({ className, children, ...props }: ArticleProps) {
  return (
    <article className={cn("prose prose-invert max-w-none", className)} {...props}>
      {children}
    </article>
  )
}

export function ArticleTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn("text-3xl font-bold tracking-tight mb-4 font-safiro", className)} {...props}>
      {children}
    </h1>
  )
}

export function ArticleMeta({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-[#C5C2BA] mb-4 font-borna", className)} {...props}>
      {children}
    </p>
  )
}

export function ArticleLead({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xl mb-6 text-[#F9F6EE] font-borna", className)} {...props}>
      {children}
    </p>
  )
}

export function ArticleContent({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mb-4 font-borna", className)} {...props}>
      {children}
    </p>
  )
}

export function ArticleActions({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap gap-2 items-center mt-6", className)} {...props}>
      {children}
    </div>
  )
}

export function ArticleButton({ className, href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <div>
      <a className={cn("text-[#B4916C] hover:underline font-borna", className)} href={href} {...props}>
        {children}
      </a>
    </div>
  )
}
