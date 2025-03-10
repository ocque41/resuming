"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CV {
  id: string;
  fileName: string;
}

interface CVComboboxProps {
  cvs: string[]; // Format: "filename|id"
  onSelect: (cvId: string, cvName: string) => void;
  placeholder?: string;
  className?: string;
  emptyMessage?: string;
  darkMode?: boolean;
  accentColor?: string;
}

export default function CVCombobox({
  cvs = [],
  onSelect,
  placeholder = "Select a CV",
  className,
  emptyMessage = "No CVs found.",
  darkMode = true,
  accentColor = "#B4916C"
}: CVComboboxProps) {
  const [open, setOpen] = useState(false);
  const [selectedCVId, setSelectedCVId] = useState<string>("");
  const [parsedCVs, setParsedCVs] = useState<CV[]>([]);

  // Parse the CV strings into objects
  useEffect(() => {
    try {
      const safeCVs = Array.isArray(cvs) ? cvs : [];
      const parsed = safeCVs.map(cv => {
        try {
          if (typeof cv !== 'string') {
            console.error("CV is not a string:", cv);
            return null;
          }
          
          const parts = cv.split('|');
          if (parts.length < 2) {
            console.error("Invalid CV format:", cv);
            return null;
          }
          
          return {
            fileName: parts[0].trim(),
            id: parts[1].trim()
          };
        } catch (innerError) {
          console.error("Error parsing CV:", innerError);
          return null;
        }
      }).filter(Boolean) as CV[];
      
      setParsedCVs(parsed);
      
      // Auto-select the first CV if available and none is selected
      if (parsed.length > 0 && !selectedCVId) {
        try {
          setSelectedCVId(parsed[0].id);
          onSelect(parsed[0].id, parsed[0].fileName);
        } catch (selectError) {
          console.error("Error auto-selecting first CV:", selectError);
        }
      }
    } catch (error) {
      console.error("Error in CVCombobox useEffect:", error);
      setParsedCVs([]);
    }
  }, [cvs, selectedCVId, onSelect]);

  // Find the selected CV name
  const selectedCVName = parsedCVs.find(cv => cv.id === selectedCVId)?.fileName || "";

  // Handle CV selection
  const handleSelectCV = (cvId: string) => {
    try {
      const selectedCV = parsedCVs.find(cv => cv.id === cvId);
      if (selectedCV) {
        setSelectedCVId(cvId);
        setOpen(false);
        onSelect(cvId, selectedCV.fileName);
      } else {
        console.error("Selected CV not found in parsed CVs");
      }
    } catch (error) {
      console.error("Error in handleSelectCV:", error);
      // Prevent the UI from crashing by handling the error gracefully
      setOpen(false);
    }
  };

  // Dynamic styles based on props
  const darkModeClasses = darkMode
    ? "bg-[#050505] border-gray-700 text-gray-300"
    : "bg-white border-gray-200 text-gray-900";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !selectedCVId && "text-gray-500",
            darkModeClasses,
            className
          )}
          style={selectedCVId ? { borderColor: accentColor } : {}}
        >
          {selectedCVId ? selectedCVName : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(
        "w-full min-w-[250px] p-0",
        darkMode ? "bg-[#121212] border border-gray-700" : "bg-white border border-gray-200"
      )}>
        <Command className={darkMode ? "bg-transparent" : ""}>
          <CommandInput 
            placeholder="Search CVs..." 
            className={darkMode ? "text-gray-300" : ""}
          />
          <CommandEmpty className={cn(
            "py-6 text-center",
            darkMode ? "text-gray-500" : "text-gray-400"
          )}>
            {emptyMessage}
          </CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-auto">
            {parsedCVs.map((cv) => (
              <CommandItem
                key={cv.id}
                value={cv.id}
                onSelect={handleSelectCV}
                className={cn(
                  "cursor-pointer",
                  darkMode 
                    ? "text-gray-300 hover:bg-[#1A1A1A] aria-selected:bg-[#B4916C]/20" 
                    : "text-gray-700 hover:bg-gray-100 aria-selected:bg-[#B4916C]/10"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedCVId === cv.id ? `opacity-100 text-[${accentColor}]` : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{cv.fileName}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 