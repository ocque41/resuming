import { CVTemplate } from "@/types/templates";
import fs from 'fs';
import path from 'path';

// Function to get all available templates
export function getTemplates(): CVTemplate[] {
  try {
    // In a production environment, we would load these from a database or API
    // For now, we'll define them statically
    const templates: CVTemplate[] = [
      {
        id: 'google-modern',
        name: 'Google Modern',
        company: 'Google',
        description: 'A modern, clean template with Google-inspired design elements.',
        thumbnail: '/templates/google-modern.png',
        previewImageUrl: '/templates/google/preview.jpg',
        templatePath: '/templates/google/template.pdf',
        metadata: {
          layout: 'two-column',
          preferredFonts: ['Roboto', 'Arial', 'Helvetica'],
          colorScheme: {
            primary: '#333333',
            secondary: '#666666',
            accent: '#4285F4',
            background: '#FFFFFF',
            text: '#000000'
          },
          sectionOrder: ['profile', 'experience', 'education', 'skills', 'projects'],
          keywordsEmphasis: ['innovation', 'leadership', 'technical', 'data-driven'],
          industrySpecific: {
            industry: 'Technology',
            requiredSkills: ['Problem Solving', 'Technical Expertise', 'Collaboration'],
            valuePropositions: ['Innovation', 'User Focus', 'Technical Excellence'],
            recruiterPreferences: ['Quantifiable Achievements', 'Project Impact', 'Technical Depth'],
            resumeStyle: 'Modern and clean with emphasis on impact and results',
            achievementFormat: 'Led [project/team] to [specific result] by [action], resulting in [quantifiable outcome]'
          }
        }
      },
      {
        id: 'apple-minimal',
        name: 'Apple Minimal',
        company: 'Apple',
        description: 'A minimalist template with Apple-inspired clean aesthetics.',
        thumbnail: '/templates/apple-minimal.png',
        previewImageUrl: '/templates/apple/preview.jpg',
        templatePath: '/templates/apple/template.pdf',
        metadata: {
          layout: 'two-column',
          preferredFonts: ['SF Pro', 'Helvetica Neue', 'Arial'],
          colorScheme: {
            primary: '#333333',
            secondary: '#666666',
            accent: '#A2AAAD',
            background: '#FFFFFF',
            text: '#000000'
          },
          sectionOrder: ['profile', 'experience', 'skills', 'education', 'projects'],
          keywordsEmphasis: ['design', 'creativity', 'user experience', 'innovation'],
          industrySpecific: {
            industry: 'Design & Technology',
            requiredSkills: ['Design Thinking', 'Attention to Detail', 'User Experience'],
            valuePropositions: ['Simplicity', 'Quality', 'Innovation'],
            recruiterPreferences: ['Portfolio', 'Design Process', 'Problem Solving'],
            resumeStyle: 'Minimalist with focus on clean typography and whitespace',
            achievementFormat: 'Designed [product/feature] that [specific impact] for [user group/market]'
          }
        }
      },
      {
        id: 'amazon-leadership',
        name: 'Amazon Leadership',
        company: 'Amazon',
        description: 'A professional template highlighting leadership principles.',
        thumbnail: '/templates/amazon-leadership.png',
        previewImageUrl: '/templates/amazon/preview.jpg',
        templatePath: '/templates/amazon/template.pdf',
        metadata: {
          layout: 'traditional',
          preferredFonts: ['Amazon Ember', 'Georgia', 'Times New Roman'],
          colorScheme: {
            primary: '#232F3E',
            secondary: '#555555',
            accent: '#FF9900',
            background: '#FFFFFF',
            text: '#000000'
          },
          sectionOrder: ['profile', 'experience', 'education', 'skills', 'leadership'],
          keywordsEmphasis: ['customer obsession', 'ownership', 'results', 'leadership'],
          industrySpecific: {
            industry: 'E-commerce & Technology',
            requiredSkills: ['Leadership', 'Customer Focus', 'Analytical Thinking'],
            valuePropositions: ['Customer Obsession', 'Ownership', 'Results Orientation'],
            recruiterPreferences: ['STAR Method', 'Leadership Principles', 'Data-Driven Decisions'],
            resumeStyle: 'Traditional with emphasis on leadership principles and customer impact',
            achievementFormat: 'Situation: [context], Task: [challenge], Action: [what you did], Result: [measurable outcome]'
          }
        }
      },
      {
        id: 'microsoft-professional',
        name: 'Microsoft Professional',
        company: 'Microsoft',
        description: 'A professional template with Microsoft-inspired design.',
        thumbnail: '/templates/microsoft-professional.png',
        previewImageUrl: '/templates/microsoft/preview.jpg',
        templatePath: '/templates/microsoft/template.pdf',
        metadata: {
          layout: 'two-column',
          preferredFonts: ['Segoe UI', 'Calibri', 'Arial'],
          colorScheme: {
            primary: '#2F2F2F',
            secondary: '#505050',
            accent: '#00A4EF',
            background: '#FFFFFF',
            text: '#000000'
          },
          sectionOrder: ['profile', 'experience', 'skills', 'education', 'projects'],
          keywordsEmphasis: ['collaboration', 'innovation', 'technical expertise', 'growth mindset'],
          industrySpecific: {
            industry: 'Software & Technology',
            requiredSkills: ['Technical Expertise', 'Collaboration', 'Problem Solving'],
            valuePropositions: ['Innovation', 'Teamwork', 'Customer Success'],
            recruiterPreferences: ['Technical Depth', 'Project Impact', 'Collaborative Achievements'],
            resumeStyle: 'Professional with clear structure and emphasis on collaboration',
            achievementFormat: 'Collaborated with [team/stakeholders] to [action] resulting in [specific outcome]'
          }
        }
      },
      {
        id: 'meta-impact',
        name: 'Meta Impact',
        company: 'Meta',
        description: 'A bold template with Meta-inspired design elements.',
        thumbnail: '/templates/meta-impact.png',
        previewImageUrl: '/templates/meta/preview.jpg',
        templatePath: '/templates/meta/template.pdf',
        metadata: {
          layout: 'two-column',
          preferredFonts: ['Optimistic Display', 'Helvetica', 'Arial'],
          colorScheme: {
            primary: '#1C2B33',
            secondary: '#4A4A4A',
            accent: '#0866FF',
            background: '#FFFFFF',
            text: '#000000'
          },
          sectionOrder: ['profile', 'experience', 'projects', 'skills', 'education'],
          keywordsEmphasis: ['impact', 'scale', 'innovation', 'connection'],
          industrySpecific: {
            industry: 'Social Media & Technology',
            requiredSkills: ['Product Thinking', 'User Focus', 'Technical Innovation'],
            valuePropositions: ['Scale', 'Connection', 'Impact'],
            recruiterPreferences: ['Product Impact', 'User-Centered Design', 'Technical Challenges'],
            resumeStyle: 'Bold and impactful with focus on scale and user impact',
            achievementFormat: 'Built [feature/product] that impacted [X users/markets] by [specific improvement]'
          }
        }
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