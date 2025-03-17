"use client"

import React from "react"

export type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

// Simple implementation that just console logs - in a real app this would show UI toast
const showToast = (props: ToastProps) => {
  console.log(`Toast: ${props.variant || 'default'}`, props.title, props.description)
  
  // In a production app, this would show a UI toast
  // For now, we're just logging to console and returning a mock ID
  return {
    id: Date.now(),
    ...props,
  }
}

// A hook for components to use toast
export const useToast = () => {
  return {
    toast: showToast
  }
}

// Direct export for importing as named import
export const toast = showToast 