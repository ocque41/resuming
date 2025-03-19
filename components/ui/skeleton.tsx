"use client";

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[#161616]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

export function SkeletonText({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn("h-4 w-full", className)}
      {...props}
    />
  );
}

export function SkeletonCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn(
        "h-40 w-full rounded-xl border border-[#222222]",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonAvatar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn(
        "h-10 w-10 rounded-full",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn(
        "h-10 w-24 rounded-lg",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonInput({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn(
        "h-12 w-full rounded-lg",
        className
      )}
      {...props}
    />
  );
}
