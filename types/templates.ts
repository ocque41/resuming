/**
 * Represents a CV document template
 */
export interface CVTemplate {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    accent: string;
  };
  font: string;
}

/**
 * Represents CV document template generation options
 */
export interface TemplateOptions {
  template: string;
  customizations?: {
    primaryColor?: string;
    accentColor?: string;
    font?: string;
  };
}

// Template collection
export const CV_TEMPLATES: CVTemplate[] = [
  // Professional Classic Template
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
  
  // Google Template
  {
    id: 'google-modern',
    name: 'Google Modern',
    description: 'Clean, data-driven format preferred by Google recruiters',
    colors: {
      primary: '#4285f4', // Google Blue
      accent: '#fbbc05', // Google Yellow
    },
    font: 'Product Sans',
  },
  
  // Meta Template
  {
    id: 'meta-impact',
    name: 'Meta Impact',
    description: 'Impact-focused template optimized for Meta hiring',
    colors: {
      primary: '#0866ff', // Meta Blue
      accent: '#42b72a',
    },
    font: 'Optimistic Display',
  },
  
  // Apple Template
  {
    id: 'apple-minimal',
    name: 'Apple Minimal',
    description: 'Minimalist design focused on details and craftsmanship',
    colors: {
      primary: '#000000',
      accent: '#06c',
    },
    font: 'SF Pro Display',
  },
  
  // Amazon Template
  {
    id: 'amazon-leadership',
    name: 'Amazon Leadership',
    description: 'Template highlighting leadership principles and quantifiable achievements',
    colors: {
      primary: '#ff9900', // Amazon Orange
      accent: '#232f3e', // Amazon Navy
    },
    font: 'Amazon Ember',
  },
  
  // Microsoft Template
  {
    id: 'microsoft-professional',
    name: 'Microsoft Professional',
    description: 'Balanced template highlighting technical and collaborative skills',
    colors: {
      primary: '#0078d4', // Microsoft Blue
      accent: '#505050',
    },
    font: 'Segoe UI',
  },
  
  // JPMorgan Template
  {
    id: 'jpmorgan-finance',
    name: 'JPMorgan Financial',
    description: 'Conservative template for financial sector positions',
    colors: {
      primary: '#0a2f5c', // JPM Navy
      accent: '#86bfe0',
    },
    font: 'Times New Roman',
  },
  
  // BlackRock Template
  {
    id: 'blackrock-asset',
    name: 'BlackRock Asset Management',
    description: 'Sophisticated template for asset management roles',
    colors: {
      primary: '#231f20', // BlackRock Black
      accent: '#6d6e71',
    },
    font: 'Avenir',
  },
  
  // Netflix Template
  {
    id: 'netflix-creative',
    name: 'Netflix Creative',
    description: 'Bold template highlighting creative and technical contributions',
    colors: {
      primary: '#e50914', // Netflix Red
      accent: '#221f1f', // Netflix Black
    },
    font: 'Netflix Sans',
  },
  
  // Tesla Template
  {
    id: 'tesla-engineering',
    name: 'Tesla Engineering',
    description: 'Sleek template emphasizing innovation and technical excellence',
    colors: {
      primary: '#cc0000', // Tesla Red
      accent: '#393c41',
    },
    font: 'Gotham',
  }
];

// Helper function to get a template by ID
export function getTemplateById(id: string, templates: CVTemplate[]): CVTemplate | undefined {
  return templates.find(template => template.id === id);
} 