import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FileDropdownProps {
  cvs: string[];
  onSelect: (id: string, name: string) => void;
  selectedCVName?: string | null;
}

export default function FileDropdown({ cvs, onSelect, selectedCVName }: FileDropdownProps) {
  // Find the full CV string that matches the selected name
  const selectedValue = cvs.find(cv => cv.split('|')[0] === selectedCVName) || '';

  return (
    <Select
      value={selectedValue}
      onValueChange={(value) => {
        const [name, id] = value.split('|');
        onSelect(id, name);
      }}
    >
      <SelectTrigger className="bg-[#1D1D1D] border-[#444444] text-white">
        <SelectValue placeholder="Select a CV">
          {selectedCVName || "Select a CV"}
        </SelectValue>
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