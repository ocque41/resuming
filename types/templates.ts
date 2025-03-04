export interface CVTemplate {
  id: string;
  name: string;
  company: string;
  description: string;
  previewImageUrl: string;
  templatePath: string; // Path to the template PDF in Dropbox
  metadata: {
    preferredFonts: string[];
    colorScheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    layout: 'one-column' | 'two-column' | 'modern' | 'traditional';
    sectionOrder: string[]; // Preferred order of sections
    keywordsEmphasis: string[]; // Keywords this company values
  };
}

// Template collection
export const CV_TEMPLATES: CVTemplate[] = [
  // Google Template
  {
    id: 'google-modern',
    name: 'Google Modern',
    company: 'Google',
    description: 'Clean, data-driven format preferred by Google recruiters',
    previewImageUrl: '/templates/google/preview.jpg',
    templatePath: '/templates/google/template.pdf',
    metadata: {
      preferredFonts: ['Product Sans', 'Roboto'],
      colorScheme: {
        primary: '#4285f4', // Google Blue
        secondary: '#ea4335', // Google Red 
        accent: '#fbbc05', // Google Yellow
        background: '#ffffff',
        text: '#3c4043',
      },
      layout: 'two-column',
      sectionOrder: ['Skills', 'Experience', 'Projects', 'Education'],
      keywordsEmphasis: ['scalability', 'data-driven', 'technical leadership', 'innovation'],
    },
  },
  
  // Meta Template
  {
    id: 'meta-impact',
    name: 'Meta Impact',
    company: 'Meta',
    description: 'Impact-focused template optimized for Meta hiring',
    previewImageUrl: '/templates/meta/preview.jpg',
    templatePath: '/templates/meta/template.pdf',
    metadata: {
      preferredFonts: ['Optimistic Display', 'SF Pro Display'],
      colorScheme: {
        primary: '#0866ff', // Meta Blue
        secondary: '#1877f2',
        accent: '#42b72a',
        background: '#ffffff',
        text: '#1c2b33',
      },
      layout: 'modern',
      sectionOrder: ['Experience', 'Impact Achievements', 'Projects', 'Skills', 'Education'],
      keywordsEmphasis: ['impact', 'scale', 'user experience', 'move fast', 'build'],
    },
  },
  
  // Apple Template
  {
    id: 'apple-minimal',
    name: 'Apple Minimal',
    company: 'Apple',
    description: 'Minimalist design focused on details and craftsmanship',
    previewImageUrl: '/templates/apple/preview.jpg',
    templatePath: '/templates/apple/template.pdf',
    metadata: {
      preferredFonts: ['SF Pro Display', 'SF Pro Text'],
      colorScheme: {
        primary: '#000000',
        secondary: '#06c',
        accent: '#f5f5f7',
        background: '#ffffff',
        text: '#1d1d1f',
      },
      layout: 'one-column',
      sectionOrder: ['Design Expertise', 'Experience', 'Skills', 'Education'],
      keywordsEmphasis: ['design', 'attention to detail', 'innovation', 'craftsmanship', 'simplicity'],
    },
  },
  
  // Amazon Template
  {
    id: 'amazon-leadership',
    name: 'Amazon Leadership',
    company: 'Amazon',
    description: 'Template highlighting leadership principles and quantifiable achievements',
    previewImageUrl: '/templates/amazon/preview.jpg',
    templatePath: '/templates/amazon/template.pdf',
    metadata: {
      preferredFonts: ['Amazon Ember', 'Arial'],
      colorScheme: {
        primary: '#ff9900', // Amazon Orange
        secondary: '#146eb4', // Amazon Blue
        accent: '#232f3e', // Amazon Navy
        background: '#ffffff',
        text: '#333333',
      },
      layout: 'two-column',
      sectionOrder: ['Professional Summary', 'Experience', 'Leadership', 'Skills', 'Education'],
      keywordsEmphasis: ['ownership', 'customer obsession', 'results', 'metrics', 'leadership principles'],
    },
  },
  
  // Microsoft Template
  {
    id: 'microsoft-professional',
    name: 'Microsoft Professional',
    company: 'Microsoft',
    description: 'Balanced template highlighting technical and collaborative skills',
    previewImageUrl: '/templates/microsoft/preview.jpg',
    templatePath: '/templates/microsoft/template.pdf',
    metadata: {
      preferredFonts: ['Segoe UI', 'Calibri'],
      colorScheme: {
        primary: '#0078d4', // Microsoft Blue
        secondary: '#50e6ff',
        accent: '#505050',
        background: '#ffffff',
        text: '#323130',
      },
      layout: 'modern',
      sectionOrder: ['Summary', 'Technical Skills', 'Experience', 'Education', 'Projects'],
      keywordsEmphasis: ['collaboration', 'innovation', 'technical expertise', 'growth mindset'],
    },
  },
  
  // JPMorgan Template
  {
    id: 'jpmorgan-finance',
    name: 'JPMorgan Financial',
    company: 'JPMorgan',
    description: 'Conservative template for financial sector positions',
    previewImageUrl: '/templates/jpmorgan/preview.jpg',
    templatePath: '/templates/jpmorgan/template.pdf',
    metadata: {
      preferredFonts: ['Times New Roman', 'Arial'],
      colorScheme: {
        primary: '#0a2f5c', // JPM Navy
        secondary: '#86bfe0',
        accent: '#c99700',
        background: '#ffffff',
        text: '#333333',
      },
      layout: 'traditional',
      sectionOrder: ['Professional Summary', 'Experience', 'Education', 'Skills', 'Certifications'],
      keywordsEmphasis: ['analysis', 'compliance', 'risk management', 'financial expertise', 'detail-oriented'],
    },
  },
  
  // BlackRock Template
  {
    id: 'blackrock-asset',
    name: 'BlackRock Asset Management',
    company: 'BlackRock',
    description: 'Sophisticated template for asset management roles',
    previewImageUrl: '/templates/blackrock/preview.jpg',
    templatePath: '/templates/blackrock/template.pdf',
    metadata: {
      preferredFonts: ['Avenir', 'Georgia'],
      colorScheme: {
        primary: '#231f20', // BlackRock Black
        secondary: '#6d6e71',
        accent: '#bbbcbf',
        background: '#ffffff',
        text: '#231f20',
      },
      layout: 'traditional',
      sectionOrder: ['Experience', 'Education', 'Skills', 'Professional Achievements'],
      keywordsEmphasis: ['investment acumen', 'analytical skills', 'portfolio management', 'client relations'],
    },
  },
  
  // Netflix Template
  {
    id: 'netflix-creative',
    name: 'Netflix Creative',
    company: 'Netflix',
    description: 'Bold template highlighting creative and technical contributions',
    previewImageUrl: '/templates/netflix/preview.jpg',
    templatePath: '/templates/netflix/template.pdf',
    metadata: {
      preferredFonts: ['Netflix Sans', 'Graphik'],
      colorScheme: {
        primary: '#e50914', // Netflix Red
        secondary: '#221f1f', // Netflix Black
        accent: '#f5f5f1', // Netflix Light Gray
        background: '#ffffff',
        text: '#221f1f',
      },
      layout: 'modern',
      sectionOrder: ['Profile', 'Experience', 'Creative Portfolio', 'Skills', 'Education'],
      keywordsEmphasis: ['creativity', 'innovation', 'storytelling', 'technical expertise', 'collaboration'],
    },
  },
  
  // Tesla Template
  {
    id: 'tesla-engineering',
    name: 'Tesla Engineering',
    company: 'Tesla',
    description: 'Sleek template emphasizing innovation and technical excellence',
    previewImageUrl: '/templates/tesla/preview.jpg',
    templatePath: '/templates/tesla/template.pdf',
    metadata: {
      preferredFonts: ['Gotham', 'Open Sans'],
      colorScheme: {
        primary: '#cc0000', // Tesla Red
        secondary: '#393c41',
        accent: '#f2f2f2',
        background: '#ffffff',
        text: '#393c41',
      },
      layout: 'two-column',
      sectionOrder: ['Technical Skills', 'Experience', 'Engineering Projects', 'Education'],
      keywordsEmphasis: ['innovation', 'efficiency', 'sustainability', 'problem-solving', 'technical expertise'],
    },
  }
];

// Helper function to get a template by ID
export function getTemplateById(id: string): CVTemplate | undefined {
  return CV_TEMPLATES.find(template => template.id === id);
}

// Helper function to get templates by company
export function getTemplatesByCompany(company: string): CVTemplate[] {
  return CV_TEMPLATES.filter(template => 
    template.company.toLowerCase() === company.toLowerCase()
  );
} 