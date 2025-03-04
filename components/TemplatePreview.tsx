"use client";

import React from 'react';
import Image from 'next/image';
import { CVTemplate } from '@/types/templates';

interface TemplatePreviewProps {
  template: CVTemplate;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function TemplatePreview({ template, isSelected = false, onClick }: TemplatePreviewProps) {
  // Determine if this template has a preview image
  const hasPreviewImage = !!template.previewImageUrl;
  
  // Generate a placeholder color from the template name if no preview image
  const generatePlaceholderColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${hash % 360}, 70%, 80%)`;
    return color;
  };
  
  const placeholderColor = generatePlaceholderColor(template.name);
  
  return (
    <div 
      className={`relative border rounded-lg overflow-hidden shadow-sm transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-blue-500 shadow-md scale-105' : 'hover:shadow-md hover:scale-105'}`}
      onClick={onClick}
    >
      <div className="aspect-[3/4] w-full">
        {hasPreviewImage ? (
          <Image
            src={template.previewImageUrl}
            alt={`${template.name} template preview`}
            fill
            className="object-cover"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: placeholderColor }}
          >
            <div className="text-center p-4">
              <div className="w-full h-4 bg-gray-200 mb-2 rounded"></div>
              <div className="w-3/4 h-4 bg-gray-200 mb-4 rounded"></div>
              <div className="w-full h-2 bg-gray-300 mb-1 rounded"></div>
              <div className="w-full h-2 bg-gray-300 mb-1 rounded"></div>
              <div className="w-4/5 h-2 bg-gray-300 mb-3 rounded"></div>
              <div className="w-full h-2 bg-gray-300 mb-1 rounded"></div>
              <div className="w-full h-2 bg-gray-300 mb-1 rounded"></div>
              <div className="w-3/4 h-2 bg-gray-300 rounded"></div>
            </div>
          </div>
        )}
      </div>
      
      <div className={`absolute top-0 right-0 m-2 px-2 py-1 text-xs font-semibold rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}>
        {template.company}
      </div>
      
      <div className="p-3 bg-white">
        <h3 className="font-medium text-sm truncate">{template.name}</h3>
        <p className="text-xs text-gray-500 truncate">{template.description.substring(0, 60)}...</p>
      </div>
    </div>
  );
} 