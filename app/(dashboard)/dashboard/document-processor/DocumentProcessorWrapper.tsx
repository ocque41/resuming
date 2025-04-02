'use client';

import dynamic from 'next/dynamic';

// Dynamically import the DocumentProcessor component
const DocumentProcessor = dynamic(
  () => import('@/app/components/DocumentProcessor'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-4xl mx-auto p-8 border rounded-lg">
        <div className="h-16 w-48 bg-gray-200 animate-pulse rounded mb-4"></div>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    )
  }
);

export default function DocumentProcessorWrapper() {
  return <DocumentProcessor />;
} 