import { NextResponse } from 'next/server';
import { CV_TEMPLATES } from '@/types/templates';

export async function GET(request: Request) {
  try {
    // Return all templates
    return NextResponse.json({ templates: CV_TEMPLATES });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// Get a specific template by ID
export async function POST(request: Request) {
  try {
    const { templateId } = await request.json();
    
    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }
    
    const template = CV_TEMPLATES.find(t => t.id === templateId);
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
} 