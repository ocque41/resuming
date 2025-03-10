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

  // Set the first option as the default value if no default value is provided
  useEffect(() => {
    if (firstRender.current && !defaultValue && options.length > 0) {
      setValue(options[0]);
      onSelect(options[0]);
      firstRender.current = false;
    }
  }, [options, defaultValue, onSelect]);

  // Dynamic styles based on props
  const accentStyle = {
    color: accentColor,
    borderColor: accentColor,
  };

  const darkModeClasses = darkMode
    ? 'bg-gray-900 border-gray-700 text-gray-300'
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
          darkMode ? "bg-gray-900 border-gray-700" : "bg-white"
        )}
      >
        <Command 
          className={darkMode ? "bg-gray-900" : ""}
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
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  setValue(option);
                  onSelect(option);
                  setOpen(false);
                }}
                className={cn(
                  darkMode ? "text-gray-300 hover:bg-gray-800" : "",
                  "cursor-pointer"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option ? "opacity-100" : "opacity-0"
                  )}
                  style={value === option ? { color: accentColor } : {}}
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
