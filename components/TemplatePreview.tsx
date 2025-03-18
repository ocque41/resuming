"use client";

import React from 'react';
import { CVTemplate } from '@/types/templates';

interface TemplatePreviewProps {
  template: CVTemplate;
  selected?: boolean;
  onClick?: () => void;
}

// Function to generate a consistent placeholder color based on template name
const generatePlaceholderColor = (templateName: string): string => {
  // Simple hash function to generate a consistent hue value from template name
  let hash = 0;
  for (let i = 0; i < templateName.length; i++) {
    hash = templateName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 85%)`;
};

// Function to determine text color based on background brightness
const getTextColor = (templateName: string): string => {
  // For BlackRock specifically, use white text
  if (templateName.includes('BlackRock')) {
    return 'text-white';
  }
  
  // For other templates, use dark text
  return 'text-gray-700';
};

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ 
  template, 
  selected = false,
  onClick 
}) => {
  // Always use placeholder, never show image preview
  const placeholderColor = generatePlaceholderColor(template.name);
  const textColorClass = getTextColor(template.name);
  
  return (
    <div 
      className={`relative flex flex-col rounded-lg border overflow-hidden shadow-sm transition-all cursor-pointer hover:shadow-md ${
        selected 
          ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      {/* Placeholder instead of image */}
      <div 
        className="w-full h-32 flex items-center justify-center"
        style={{ backgroundColor: placeholderColor }}
      >
        <span className={`text-2xl font-bold ${textColorClass} opacity-80`}>
          {template.name.charAt(0)}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900">{template.name}</h3>
        <p className="text-xs text-gray-500">{template.description}</p>
      </div>
    </div>
  );
}; 