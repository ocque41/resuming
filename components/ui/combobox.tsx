// components/ui/combobox.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ComboboxPopoverProps {
  options: string[];
  label: string;
  onSelect: (value: string) => void;
  defaultValue?: string;
  accentColor?: string;
  darkMode?: boolean;
}

export function ComboboxPopover({
  options,
  label,
  onSelect,
  defaultValue,
  accentColor = '#0284c7',
  darkMode = false,
}: ComboboxPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue || '');
  const firstRender = useRef(true);
  
  // Ensure options is always an array
  const safeOptions = Array.isArray(options) ? options : [];

  // Set the first option as the default value if no default value is provided
  useEffect(() => {
    if (firstRender.current && !defaultValue && safeOptions.length > 0) {
      setValue(safeOptions[0]);
      onSelect(safeOptions[0]);
      firstRender.current = false;
    }
  }, [safeOptions, defaultValue, onSelect]);

  // Reset value if current value not in safeOptions
  useEffect(() => {
    if (safeOptions.length > 0 && !safeOptions.includes(value)) {
      setValue(safeOptions[0]);
      onSelect(safeOptions[0]);
    }
  }, [safeOptions, value, onSelect]);

  // Dynamic styles based on props
  const accentStyle = {
    color: accentColor,
    borderColor: accentColor,
  };

  const darkModeClasses = darkMode
    ? 'bg-[#050505] border-gray-700 text-gray-300'
    : 'bg-white border-gray-200 text-gray-900';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            darkModeClasses
          )}
          style={value ? { borderColor: accentColor } : {}}
        >
          <span className="truncate">
            {value ? value : label}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "w-full p-0",
          darkMode ? "bg-[#050505] border-gray-700" : "bg-white"
        )}
      >
        <Command 
          className={darkMode ? "bg-[#050505]" : ""}
        >
          <CommandInput 
            placeholder={`Search ${label.toLowerCase()}...`} 
            className={darkMode ? "text-gray-300" : ""}
          />
          <CommandEmpty 
            className={darkMode ? "text-gray-400" : ""}
          >
            No {label.toLowerCase()} found.
          </CommandEmpty>
          <CommandGroup>
            {safeOptions.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={(currentValue) => {
                  setValue(currentValue);
                  setOpen(false);
                  onSelect(currentValue);
                }}
                className={darkMode ? "text-gray-300 hover:bg-gray-800" : ""}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option ? "opacity-100" : "opacity-0"
                  )}
                  style={value === option ? accentStyle : {}}
                />
                {option}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
