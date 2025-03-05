'use client';

import { useState, useEffect } from 'react';
import { CVTemplate } from '@/types/templates';
import Image from 'next/image';

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
        
        // Add appropriate image paths or use company-specific images that exist
        const templatesWithPreviews = data.templates.map((template: CVTemplate) => {
          const company = template.company.toLowerCase();
          
          // Try to use company-specific images that we know exist
          let previewPath = '';
          if (company === 'google') {
            previewPath = '/templates/google/google1.png';
          } else if (company === 'meta') {
            previewPath = '/templates/meta/meta1.png';
          } else if (company === 'amazon') {
            previewPath = '/templates/amazon/amazon1.png';
          } else if (company === 'apple') {
            previewPath = '/templates/apple/apple1.png';
          } else if (company === 'microsoft') {
            previewPath = '/templates/microsoft/microsoft1.png';
          }
          
          return {
            ...template,
            previewImageUrl: previewPath || template.previewImageUrl
          };
        });
        
        setTemplates(templatesWithPreviews);
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
        {templates.map(template => {
          // Get first two letters of company name for the fallback
          const companyInitials = template.company.slice(0, 2).toUpperCase();
          
          return (
            <div 
              key={template.id}
              className={`template-card p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md
                ${selectedTemplateId === template.id 
                  ? 'ring-2 shadow-sm' 
                  : darkMode 
                    ? 'border-[#333333] hover:border-[#444444]' 
                    : 'border-gray-200 hover:border-gray-300'}`}
              style={{
                borderColor: selectedTemplateId === template.id ? `${accentColor}` : '',
                '--tw-ring-color': selectedTemplateId === template.id ? `${accentColor}40` : '',
                backgroundColor: darkMode ? '#050505' : 'white'
              } as React.CSSProperties}
              onClick={() => onSelect(template.id)}
            >
              <div className="aspect-w-3 aspect-h-4 mb-2 relative overflow-hidden rounded-md">
                {template.previewImageUrl && !isOptimizing ? (
                  <Image 
                    src={template.previewImageUrl}
                    alt={`${template.name} template preview`}
                    width={300}
                    height={400}
                    className="object-cover"
                    onError={(e) => {
                      // If image fails to load, replace with fallback
                      const imgElement = e.currentTarget as HTMLImageElement;
                      imgElement.style.display = 'none';
                      // Type assertion for nextElementSibling as HTMLElement
                      const fallbackElement = imgElement.nextElementSibling as HTMLElement;
                      if (fallbackElement) {
                        fallbackElement.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div 
                  className={`w-full h-full ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center ${template.previewImageUrl && !isOptimizing ? 'hidden' : ''}`}
                  style={{ 
                    display: template.previewImageUrl && !isOptimizing ? 'none' : 'flex',
                    backgroundColor: template.metadata?.colorScheme?.primary || (darkMode ? '#1a1a1a' : '#f3f4f6')
                  }}
                >
                  <span 
                    className="text-xl font-semibold text-white"
                    style={{ 
                      color: selectedTemplateId === template.id 
                        ? '#ffffff' 
                        : (template.metadata?.colorScheme?.text || '#ffffff')
                    }}
                  >
                    {companyInitials}
                  </span>
                </div>
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
          );
        })}
      </div>
    </div>
  );
} 