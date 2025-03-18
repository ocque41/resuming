'use client';

import { useState, useEffect } from 'react';
import { CVTemplate } from '@/types/templates';
import { TemplatePreview } from './TemplatePreview';

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void;
  selectedTemplateId?: string;
  accentColor?: string;
  darkMode?: boolean;
  isOptimizing?: boolean;
}

export default function TemplateSelector({ 
  onSelect, 
  selectedTemplateId,
  accentColor = "#B4916C",
  darkMode = false,
  isOptimizing = false
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
      } catch (err: any) {
        console.error('Error fetching templates:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTemplates();
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" 
             style={{ borderColor: accentColor }}></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {templates.map((template) => (
        <div key={template.id} onClick={() => !isOptimizing && onSelect(template.id)}>
          <TemplatePreview 
            template={template} 
            selected={template.id === selectedTemplateId}
          />
        </div>
      ))}
    </div>
  );
} 