'use client';

import { useState, useEffect } from 'react';
import { CVTemplate } from '@/types/templates';
import Image from 'next/image';

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void;
  selectedTemplateId?: string;
  accentColor?: string;
  darkMode?: boolean;
}

export default function TemplateSelector({ 
  onSelect, 
  selectedTemplateId,
  accentColor = "#B4916C",
  darkMode = false
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<CVTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch templates from API
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        const response = await fetch('/api/cv-templates');
        
        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }
        
        const data = await response.json();
        setTemplates(data.templates);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError('Failed to load templates. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTemplates();
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: accentColor }}></div>
        <span className={`ml-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading templates...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`p-4 ${darkMode ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'} border rounded-md`}>
        <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-500'}`}>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="template-gallery">
      <p className={`mb-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Select a template optimized for your target company</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {templates.map(template => (
          <div 
            key={template.id}
            className={`template-card p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md
              ${selectedTemplateId === template.id 
                ? 'ring-2 shadow-sm' 
                : darkMode 
                  ? 'border-gray-700 hover:border-gray-600' 
                  : 'border-gray-200 hover:border-gray-300'}`}
            style={{
              borderColor: selectedTemplateId === template.id ? `${accentColor}` : '',
              '--tw-ring-color': selectedTemplateId === template.id ? `${accentColor}40` : '',
              backgroundColor: darkMode ? '#050505' : 'white'
            } as React.CSSProperties}
            onClick={() => onSelect(template.id)}
          >
            <div className="aspect-w-3 aspect-h-4 mb-2 relative overflow-hidden rounded-md">
              {template.previewImageUrl ? (
                <Image 
                  src={template.previewImageUrl} 
                  alt={`${template.company} Template`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className={`w-full h-full ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center`}>
                  <span className={`${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>No preview</span>
                </div>
              )}
            </div>
            <h3 
              className="font-medium" 
              style={{ color: selectedTemplateId === template.id 
                ? accentColor 
                : darkMode ? 'rgb(209 213 219)' : '' 
              }}
            >
              {template.name}
            </h3>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
} 