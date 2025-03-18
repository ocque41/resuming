"use client";

import React, { useState } from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

// Define template options
const TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean and minimal design with professional styling',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with bold elements and spacing',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional resume format with timeless styling',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Unique layout with creative elements for design roles',
  },
];

interface CVDocumentTemplateSelectorProps {
  selectedTemplate?: string;
  onSelectTemplate: (templateId: string) => void;
}

export default function CVDocumentTemplateSelector({
  selectedTemplate = 'professional',
  onSelectTemplate,
}: CVDocumentTemplateSelectorProps) {
  const [template, setTemplate] = useState<string>(selectedTemplate);

  const handleTemplateChange = (value: string) => {
    setTemplate(value);
    onSelectTemplate(value);
  };

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Select Template</h3>
      
      <RadioGroup
        defaultValue={template}
        onValueChange={handleTemplateChange}
        className="grid grid-cols-2 gap-3"
      >
        {TEMPLATES.map((tmpl) => (
          <div key={tmpl.id} className="relative">
            <RadioGroupItem
              value={tmpl.id}
              id={`template-${tmpl.id}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`template-${tmpl.id}`}
              className="flex flex-col h-full px-3 py-2 bg-black border rounded-md cursor-pointer border-gray-800 hover:border-[#B4916C]/50 peer-data-[state=checked]:border-[#B4916C] peer-data-[state=checked]:bg-[#B4916C]/10"
            >
              <span className="text-sm font-medium text-white">{tmpl.name}</span>
              <span className="text-xs text-gray-500 mt-1">{tmpl.description}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
} 