import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helpText?: string;
  error?: string;
  icon?: LucideIcon;
  containerClassName?: string;
  labelClassName?: string;
  inputContainerClassName?: string;
  inputClassName?: string;
  helpTextClassName?: string;
  errorClassName?: string;
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      helpText,
      error,
      icon: Icon,
      containerClassName,
      labelClassName,
      inputContainerClassName,
      inputClassName,
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
        
        <div 
          className={cn(
            "relative rounded-lg shadow-sm", 
            inputContainerClassName,
            error ? "border-[#3d1a1a]" : ""
          )}
        >
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon className="h-5 w-5 text-[#F9F6EE]/40" />
            </div>
          )}
          
          <input
            ref={ref}
            className={cn(
              "block w-full px-4 py-3 bg-[#111111] text-[#F9F6EE] border border-[#333333] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B4916C] focus:border-transparent transition-colors duration-200 placeholder:text-[#F9F6EE]/30 font-borna",
              Icon ? "pl-10" : "",
              error ? "border-[#3d1a1a] bg-[#1a0505]" : "",
              inputClassName
            )}
            {...props}
          />
        </div>
        
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

FormInput.displayName = "FormInput";

export { FormInput }; 