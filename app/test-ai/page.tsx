import React from 'react';
import { Metadata } from 'next';
import SimpleAITest from '@/SimpleAITest';

export const metadata: Metadata = {
  title: 'AI Agent Test',
  description: 'Test the AI Document Agent API with simple messages',
};

export default function TestAIPage() {
  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">AI Document Agent Test</h1>
        <p className="mb-8 text-gray-600">
          This page allows you to test the AI Document Agent API without requiring a document.
          Simply type a message like &quot;Hello&quot; to test if the API is responding correctly.
        </p>
        
        <SimpleAITest />
      </div>
    </div>
  );
} 