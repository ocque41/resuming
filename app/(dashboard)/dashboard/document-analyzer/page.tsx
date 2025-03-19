import { Metadata } from 'next';
import { DocumentAnalyzer } from '@/components/advanced-document-analyzer/DocumentAnalyzer';

export const metadata: Metadata = {
  title: 'Document Analyzer | CVOptimizer',
  description: 'Analyze your documents with AI to get insights and recommendations for improvement.',
};

export default function DocumentAnalyzerPage() {
  return (
    <div className="px-4 md:px-8 pt-6 pb-12 max-w-7xl mx-auto">
      <DocumentAnalyzer />
    </div>
  );
} 