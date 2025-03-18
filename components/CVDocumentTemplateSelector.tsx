'use client';

import React from 'react';
import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, FileText } from 'lucide-react';
import { CVTemplate } from '@/types/templates';

interface TemplateSelectorProps {
  onSelect: (template: string) => void;
  selectedTemplate?: string;
}

const templates: CVTemplate[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean and traditional format for corporate roles',
    colors: { primary: '#333333', accent: '#B4916C' },
    font: 'Arial',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with blue accents',
    colors: { primary: '#2D5597', accent: '#4472C4' },
    font: 'Calibri',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple black and white for a clean look',
    colors: { primary: '#000000', accent: '#666666' },
    font: 'Calibri Light',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Bold design for creative industries',
    colors: { primary: '#7030A0', accent: '#A5A5A5' },
    font: 'Century Gothic',
  },
];

export default function CVDocumentTemplateSelector({ onSelect, selectedTemplate = 'professional' }: TemplateSelectorProps) {
  const [selected, setSelected] = useState<string>(selectedTemplate);

  const handleSelect = (templateId: string) => {
    setSelected(templateId);
    onSelect(templateId);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[#B4916C]">Select Document Template</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {templates.map((template) => {
          const isSelected = selected === template.id;
          
          return (
            <Card 
              key={template.id}
              className={`cursor-pointer transition-all border ${
                isSelected 
                  ? 'border-[#B4916C] shadow-md' 
                  : 'border-gray-800 hover:border-gray-600'
              }`}
              onClick={() => handleSelect(template.id)}
            >
              <div className="absolute top-2 right-2">
                {isSelected && (
                  <div className="bg-[#B4916C] text-black rounded-full p-1">
                    <Check size={16} />
                  </div>
                )}
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-md" style={{ color: template.colors.primary }}>
                  {template.name}
                </CardTitle>
                <CardDescription className="text-xs text-gray-400">
                  {template.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div 
                  className="rounded border border-gray-800 flex items-center justify-center py-4"
                  style={{ backgroundColor: '#050505' }}
                >
                  <div className="relative w-24 h-32 flex flex-col border border-gray-700">
                    {/* Template preview */}
                    <div 
                      className="h-6 w-full flex items-center justify-center text-[9px] font-bold"
                      style={{ 
                        backgroundColor: template.colors.primary,
                        color: 'white',
                        fontFamily: template.font
                      }}
                    >
                      NAME
                    </div>
                    <div className="flex-1 p-1">
                      {/* Content lines */}
                      <div className="h-1 w-full mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.7 }}></div>
                      <div className="h-1 w-5/6 mb-1 rounded" style={{ backgroundColor: template.colors.accent, opacity: 0.5 }}></div>
                      <div className="h-1 w-11/12 mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.2 }}></div>
                      <div className="h-1 w-3/4 mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.2 }}></div>
                      <div className="h-1 w-5/6 mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.2 }}></div>
                      
                      <div className="h-1 w-2/3 my-2 rounded" style={{ backgroundColor: template.colors.accent, opacity: 0.7 }}></div>
                      
                      <div className="h-1 w-5/6 mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.2 }}></div>
                      <div className="h-1 w-11/12 mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.2 }}></div>
                      <div className="h-1 w-3/4 mb-1 rounded" style={{ backgroundColor: template.colors.primary, opacity: 0.2 }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="pt-0">
                <Button 
                  variant={isSelected ? "default" : "outline"} 
                  size="sm" 
                  className="w-full text-xs"
                  style={{ 
                    backgroundColor: isSelected ? template.colors.primary : 'transparent',
                    borderColor: isSelected ? template.colors.primary : '#333333',
                    color: isSelected ? 'white' : '#999999'
                  }}
                  onClick={() => handleSelect(template.id)}
                >
                  <FileText size={14} className="mr-1" />
                  {isSelected ? 'Selected' : 'Select'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 