"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helpText?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  textareaClassName?: string;
  helpTextClassName?: string;
  errorClassName?: string;
}

const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      helpText,
      error,
      containerClassName,
      labelClassName,
      textareaClassName,
      helpTextClassName,
      errorClassName,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("space-y-2", containerClassName)}>
        {label && (
          <label
            htmlFor={props.id}
            className={cn(
              "block text-sm font-medium text-[#F9F6EE] font-safiro", 
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          className={cn(
            "block w-full px-4 py-3 bg-[#111111] text-[#F9F6EE] border border-[#333333] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B4916C] focus:border-transparent transition-colors duration-200 placeholder:text-[#F9F6EE]/30 resize-none font-borna min-h-[120px]",
            error ? "border-[#3d1a1a] bg-[#1a0505]" : "",
            textareaClassName
          )}
          {...props}
        />
        
        {helpText && !error && (
          <p 
            className={cn(
              "text-xs text-[#F9F6EE]/50 font-borna", 
              helpTextClassName
            )}
          >
            {helpText}
          </p>
        )}
        
        {error && (
          <p 
            className={cn(
              "text-xs text-[#f5c2c2] font-borna", 
              errorClassName
            )}
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = "FormTextarea";

export { FormTextarea }; 