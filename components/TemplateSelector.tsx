'use client';

import { useState, useEffect } from 'react';
import { CVTemplate } from '@/types/templates';
import Image from 'next/image';

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void;
  selectedTemplateId?: string;
}

export default function TemplateSelector({ onSelect, selectedTemplateId }: TemplateSelectorProps) {
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
    return <div className="flex justify-center p-8">Loading templates...</div>;
  }
  
  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }
  
  return (
    <div className="template-gallery">
      <h2 className="text-xl font-bold mb-4">Choose a Template</h2>
      <p className="mb-4">Select a template optimized for your target company</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {templates.map(template => (
          <div 
            key={template.id}
            className={`template-card p-3 border rounded-lg cursor-pointer transition-all 
              ${selectedTemplateId === template.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-gray-300'}`}
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
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400">No preview</span>
                </div>
              )}
            </div>
            <h3 className="font-medium">{template.name}</h3>
            <p className="text-sm text-gray-500">{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
} 