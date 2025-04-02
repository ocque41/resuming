import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { DocumentCreationAgent } from '@/lib/agents/DocumentCreationAgent';
import { agentRequestSchema } from '@/lib/agents/config';

// Use simple console logging to avoid any import issues
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
  }
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = agentRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { prompt, role, document } = validation.data;
    const template = document?.template || 'blank';
    
    const context = {
      userId: session.user.id,
      settings: {
        language: 'en',
        style: 'professional',
        tone: 'formal',
      },
    };

    const agent = new DocumentCreationAgent(context);
    const response = await agent.createDocument(prompt, template);

    logger.info('Document created successfully', {
      userId: session.user.id,
      template,
      metadata: response.metadata,
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error creating document: ${errorMessage}`);

    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
} 