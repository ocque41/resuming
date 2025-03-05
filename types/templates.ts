export interface CVTemplate {
  id: string;
  name: string;
  company: string;
  description: string;
  previewImageUrl: string;
  templatePath: string; // Path to the template PDF in Dropbox
  thumbnail: string;
  metadata: {
    preferredFonts: string[];
    colorScheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    layout: 'two-column' | 'one-column' | 'modern' | 'traditional';
    sectionOrder: string[]; // Preferred order of sections
    keywordsEmphasis: string[]; // Keywords this company values
    industrySpecific: {
      industry: string;
      requiredSkills: string[];
      valuePropositions: string[];
      recruiterPreferences: string[];
      resumeStyle: string;
      achievementFormat: string;
    };
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
    thumbnail: '/templates/google/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Technology',
        requiredSkills: ['Data Structures', 'Algorithms', 'System Design', 'Cloud Computing', 'Machine Learning', 'Distributed Systems'],
        valuePropositions: [
          'User-focused problem solving',
          'Data-driven decision making',
          'Scale and complexity management',
          'Innovation and creativity in solutions'
        ],
        recruiterPreferences: [
          'Quantifiable achievements with metrics',
          'Well-structured technical projects',
          'Clear demonstration of impact',
          'Leadership and collaboration examples'
        ],
        resumeStyle: 'Clean, data-oriented with clear metrics and achievements. Google recruiters appreciate clean, well-organized resumes that emphasize measurable impact.',
        achievementFormat: 'ACTION + QUANTIFIABLE RESULT + IMPACT: "Implemented a new algorithm that reduced latency by 40%, improving user satisfaction scores by 15%"'
      }
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
    thumbnail: '/templates/meta/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Social Media & Technology',
        requiredSkills: ['Full Stack Development', 'Mobile Engineering', 'AI/ML', 'AR/VR', 'Product Thinking', 'UX Design'],
        valuePropositions: [
          'Building communities at scale',
          'Connecting people through technology',
          'Delivering impactful user experiences',
          'Moving fast with stable infrastructure'
        ],
        recruiterPreferences: [
          'Impact-driven bullet points',
          'Demonstrated ownership of projects',
          'Evidence of rapid iteration',
          'Understanding of social dynamics'
        ],
        resumeStyle: "Impact-focused with emphasis on scale and user engagement. Meta's culture values moving fast and building things that connect people.",
        achievementFormat: 'SCOPE + ACTION + RESULT: "Led a team of 5 engineers to develop a feature that increased user engagement by 25% across 2M daily active users"'
      }
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
    thumbnail: '/templates/apple/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Consumer Technology & Design',
        requiredSkills: ['UI/UX Design', 'Human Interface Guidelines', 'Swift/SwiftUI', 'Product Design', 'Attention to Detail', 'Cross-functional Collaboration'],
        valuePropositions: [
          'Elegant simplicity in execution',
          'User-centered design thinking',
          'Meticulous attention to detail',
          'Integration of hardware and software experiences'
        ],
        recruiterPreferences: [
          'Clean, minimal presentation',
          'Focus on quality over quantity',
          'Evidence of design thinking',
          'Detail-oriented project descriptions'
        ],
        resumeStyle: 'Minimalist with meticulous attention to typography and spacing. Apple values elegant simplicity and exceptional attention to detail.',
        achievementFormat: 'REFINED OUTCOME + QUALITY FOCUS: "Reimagined the user onboarding experience, reducing complexity while increasing completion rates by 30%"'
      }
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
    thumbnail: '/templates/amazon/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'E-commerce & Cloud Computing',
        requiredSkills: ['Data Analysis', 'Customer-Focused Problem Solving', 'Operations Management', 'Supply Chain Optimization', 'AWS Technologies', 'Project Management'],
        valuePropositions: [
          'Customer obsession',
          'Ownership of results',
          'Bias for action',
          'Frugality in resource usage',
          'Delivery of high standards'
        ],
        recruiterPreferences: [
          'STAR format (Situation, Task, Action, Result)',
          'Metrics-driven achievements',
          'Leadership principles alignment',
          'Examples of raising the bar'
        ],
        resumeStyle: "Metrics-driven with clear STAR format examples aligning with Amazon's leadership principles.",
        achievementFormat: 'SITUATION + TASK + ACTION + RESULT: "Facing declining customer satisfaction (76%), led initiative to redesign checkout process, resulting in 15% faster completion and 94% satisfaction"'
      }
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
    thumbnail: '/templates/microsoft/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Enterprise Software & Cloud Computing',
        requiredSkills: ['.NET Development', 'Azure Cloud Services', 'DevOps', 'Enterprise Solutions', 'AI/ML Integration', 'Cross-Platform Development'],
        valuePropositions: [
          'Growth mindset approach',
          'Enterprise-scale solution design',
          'Collaborative innovation',
          'Cloud-first thinking'
        ],
        recruiterPreferences: [
          'Balance of technical and collaborative skills',
          'Evidence of continuous learning',
          'Cross-functional teamwork examples',
          'Enterprise solution design thinking'
        ],
        resumeStyle: 'Professional, balanced template with focus on both technical expertise and collaboration skills. Microsoft values a growth mindset and lifelong learning.',
        achievementFormat: 'SKILL + ACTION + BUSINESS OUTCOME: "Leveraged Azure Machine Learning to develop a predictive maintenance system that reduced downtime by 35% for manufacturing clients"'
      }
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
    thumbnail: '/templates/jpmorgan/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Financial Services & Banking',
        requiredSkills: ['Financial Analysis', 'Regulatory Compliance', 'Risk Management', 'Financial Modeling', 'Client Relationship Management', 'Market Research'],
        valuePropositions: [
          'Rigorous analytical approach',
          'Adherence to compliance standards',
          'Strategic risk assessment',
          'Client-focused financial solutions'
        ],
        recruiterPreferences: [
          'Conservative, traditional formatting',
          'Strong educational credentials',
          'Evidence of precision and accuracy',
          'Quantifiable financial impacts'
        ],
        resumeStyle: 'Conservative and traditional with emphasis on credentials, analytical skills and risk management. Financial institutions value precision and regulatory awareness.',
        achievementFormat: 'CONTEXT + ANALYTICAL ACTION + FINANCIAL IMPACT: "Analyzed portfolio performance across 200+ client accounts, implementing rebalancing strategy that improved returns by 12% while reducing risk exposure"'
      }
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
    thumbnail: '/templates/blackrock/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Asset Management & Investment',
        requiredSkills: ['Portfolio Management', 'Asset Allocation', 'Risk Analysis', 'Financial Modeling', 'Market Trend Analysis', 'ESG Investment Principles'],
        valuePropositions: [
          'Sophisticated investment strategies',
          'Data-driven portfolio decisions',
          'Risk-adjusted performance optimization',
          'Long-term fiduciary mindset'
        ],
        recruiterPreferences: [
          'Polished presentation with clear structure',
          'Academic excellence indicators',
          'Investment philosophy articulation',
          'Performance metrics and achievements'
        ],
        resumeStyle: 'Sophisticated, refined formatting with emphasis on educational credentials and quantitative achievements. BlackRock values analytical rigor and sophistication.',
        achievementFormat: 'INVESTMENT CONTEXT + STRATEGY + PERFORMANCE OUTCOME: "Developed ESG-focused investment strategy for $200M portfolio, achieving 9.5% annual returns while exceeding sustainability benchmarks"'
      }
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
    thumbnail: '/templates/netflix/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Entertainment & Streaming Media',
        requiredSkills: ['Content Production', 'Data-Driven Creativity', 'Audience Analytics', 'Personalization Algorithms', 'Streaming Technology', 'Creative Direction'],
        valuePropositions: [
          'Creative risk-taking',
          'Data-informed content decisions',
          'Global entertainment perspective',
          'Technical and creative integration'
        ],
        recruiterPreferences: [
          'Bold, creative presentation',
          'Evidence of innovation and originality',
          'Combination of creative and analytical skills',
          'Understanding of global audience dynamics'
        ],
        resumeStyle: 'Bold and creative with a balance of analytical skills and artistic vision. Netflix values both data-driven decisions and creative risk-taking.',
        achievementFormat: 'CREATIVE INITIATIVE + AUDIENCE IMPACT: "Conceptualized and implemented A/B testing for thumbnail designs, increasing click-through rates by 28% across international markets"'
      }
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
    thumbnail: '/templates/tesla/thumbnail.jpg',
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
      industrySpecific: {
        industry: 'Automotive & Clean Energy',
        requiredSkills: ['Mechanical Engineering', 'Electrical Systems', 'Battery Technology', 'Manufacturing Optimization', 'Sustainable Design', 'Robotics & Automation'],
        valuePropositions: [
          'Accelerating sustainable transportation',
          'First-principles thinking approach',
          'Disruptive innovation mindset',
          'Engineering excellence with simplicity'
        ],
        recruiterPreferences: [
          'Clean, efficient presentation',
          'Evidence of contrarian thinking',
          'Passion for sustainable technology',
          'Demonstrated persistence through challenges'
        ],
        resumeStyle: 'Sleek and innovative with focus on technical excellence and first-principles thinking. Tesla values disruptive innovation and engineering efficiency.',
        achievementFormat: 'PROBLEM + INNOVATIVE APPROACH + EFFICIENCY OUTCOME: "Redesigned production sequence using first-principles approach, eliminating 3 redundant steps and increasing output by 47%"'
      }
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