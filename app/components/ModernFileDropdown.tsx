import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModernFileDropdownProps {
  cvs: string[];
  onSelect: (id: string, name: string) => void;
  selectedCVName?: string | null;
}

export function ModernFileDropdown({ cvs, onSelect, selectedCVName }: ModernFileDropdownProps) {
  return (
    <Select
      value={selectedCVName || undefined}
      onValueChange={(value) => {
        const [name, id] = value.split('|');
        onSelect(id, name);
      }}
    >
      <SelectTrigger className="bg-[#1D1D1D] border-[#444444] text-white">
        <SelectValue placeholder="Select a CV" />
      </SelectTrigger>
      <SelectContent className="bg-[#1D1D1D] border-[#444444] text-white">
        {cvs.map((cv) => {
          const [name, id] = cv.split('|');
          return (
            <SelectItem key={id} value={cv}>
              {name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
} 