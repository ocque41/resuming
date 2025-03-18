import { CVTemplate } from "@/types/templates";

// Function to get all available templates
export function getTemplates(): CVTemplate[] {
  try {
    // In a production environment, we would load these from a database or API
    // For now, we'll define them statically
    const templates: CVTemplate[] = [
      {
        id: 'professional-classic',
        name: 'Professional Classic',
        description: 'Clean, professional layout with clear section organization',
        colors: {
          primary: '#000000', // Black for main text
          accent: '#000000', // Black for accents
        },
        font: 'Arial',
      },
      {
        id: 'google-modern',
        name: 'Google Modern',
        description: 'A modern, clean template with Google-inspired design elements.',
        colors: {
          primary: '#333333',
          accent: '#4285F4',
        },
        font: 'Roboto',
      },
      {
        id: 'apple-minimal',
        name: 'Apple Minimal',
        description: 'A minimalist template with Apple-inspired clean aesthetics.',
        colors: {
          primary: '#333333',
          accent: '#A2AAAD',
        },
        font: 'SF Pro',
      },
      {
        id: 'amazon-leadership',
        name: 'Amazon Leadership',
        description: 'A professional template highlighting leadership principles.',
        colors: {
          primary: '#232F3E',
          accent: '#FF9900',
        },
        font: 'Amazon Ember',
      },
      {
        id: 'microsoft-professional',
        name: 'Microsoft Professional',
        description: 'A professional template with Microsoft-inspired design.',
        colors: {
          primary: '#2F2F2F',
          accent: '#00A4EF',
        },
        font: 'Segoe UI',
      },
      {
        id: 'meta-impact',
        name: 'Meta Impact',
        description: 'A bold template with Meta-inspired design elements.',
        colors: {
          primary: '#1C2B33',
          accent: '#0866FF',
        },
        font: 'Optimistic Display',
      }
    ];
    
    return templates;
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
}

// Function to get a template by ID
export function getTemplateById(id: string): CVTemplate | undefined {
  const templates = getTemplates();
  return templates.find(template => template.id === id);
}

// Function to get template preview image path
export function getTemplatePreviewPath(templateId: string): string {
  return `/templates/${templateId}.png`;
} 