import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Tag } from 'lucide-react';
import { DocumentTopic, ApiDocumentTopic } from './types';

interface AnalysisTopicsProps {
  topics: (DocumentTopic | ApiDocumentTopic | any)[] | undefined;
}

const AnalysisTopics: React.FC<AnalysisTopicsProps> = ({ topics }) => {
  // Function to normalize topics to a consistent format
  const normalizeTopics = (topics: any[]): { name: string; relevance: number }[] => {
    if (!topics || !Array.isArray(topics)) {
      console.warn("Topics is not an array:", topics);
      return [];
    }

    return topics.map(topic => {
      if (typeof topic === 'string') {
        return { name: topic, relevance: 1 };
      } else if (topic && typeof topic === 'object') {
        // Handle API response format or internal format
        const name = topic.label || topic.name || topic.topic || String(topic);
        const relevance = topic.relevance || topic.score || topic.weight || 1;
        return { name, relevance: Number(relevance) };
      }
      return { name: String(topic), relevance: 1 };
    }).filter(t => t.name && t.name.trim() !== '');
  };

  const normalizedTopics = normalizeTopics(topics || []);

  // Sort topics by relevance
  const sortedTopics = [...normalizedTopics].sort((a, b) => b.relevance - a.relevance);

  // Format relevance score as percentage
  const formatRelevance = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  if (!normalizedTopics.length) {
    return (
      <Card className="bg-[#161616] border-[#222222]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-10 text-center">
            <div className="space-y-3">
              <Tag className="h-10 w-10 text-[#8A8782] mx-auto" />
              <h3 className="text-[#F9F6EE] font-medium">No Topics Found</h3>
              <p className="text-[#8A8782] text-sm max-w-md">
                No key topics were detected in this document.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#161616] border-[#222222]">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#B4916C]" />
            <h3 className="text-lg font-medium text-[#F9F6EE]">Key Topics</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sortedTopics.map((topic, index) => (
              <div
                key={`${topic.name}-${index}`}
                className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#222222]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B4916C]/20 text-[#B4916C]">
                    {index + 1}
                  </div>
                  <span className="text-[#F9F6EE]">{topic.name}</span>
                </div>
                <div className="text-sm text-[#8A8782]">
                  {formatRelevance(topic.relevance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisTopics; 