'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// Define the prop types expected by OpenAIAgentClient
type OpenAIAgentClientProps = {
  mode?: 'analyze' | 'edit' | 'create';
  documentId?: string;
  documentKey?: string;
  className?: string;
};

// Dynamically import the OpenAIAgentClient to prevent server-side rendering issues
const DynamicOpenAIAgentClient = dynamic<OpenAIAgentClientProps>(
  () => import('@/app/components/OpenAIAgentClient'),
  { 
    loading: () => <AgentClientSkeleton />,
    ssr: false
  }
);

// Skeleton component for loading state
function AgentClientSkeleton() {
  return (
    <Card className="w-full h-[600px] flex flex-col">
      <div className="p-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex justify-between items-center mt-4">
          <Skeleton className="h-10 w-[300px]" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex-grow p-4">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="p-4 border-t">
        <div className="flex items-center w-full space-x-2">
          <Skeleton className="h-10 flex-grow" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </Card>
  );
}

export default function OpenAIAgentClientWrapper() {
  const [mode, setMode] = useState<'analyze' | 'edit' | 'create'>('analyze');
  const [documentId, setDocumentId] = useState<string | undefined>(undefined);
  
  const handleModeChange = (newMode: 'analyze' | 'edit' | 'create') => {
    setMode(newMode);
  };
  
  const handleDocumentSelect = (docId: string | null) => {
    setDocumentId(docId || undefined);
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <DynamicOpenAIAgentClient 
        mode={mode}
        documentId={documentId}
        className="w-full"
      />
    </div>
  );
} 