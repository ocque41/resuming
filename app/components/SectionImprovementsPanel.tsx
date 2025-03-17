import React from 'react';

interface SectionImprovementsPanelProps {
  improvements: Record<string, string>;
  enhancedProfile: string;
}

export function SectionImprovementsPanel({ improvements, enhancedProfile }: SectionImprovementsPanelProps) {
  return (
    <div className="bg-[#050505] border border-gray-800 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-medium mb-3 text-[#B4916C]">CV Section Improvements</h3>
      
      {/* Enhanced Profile Section */}
      {enhancedProfile && (
        <div className="mb-4">
          <h4 className="font-medium text-white mb-2">Enhanced Profile</h4>
          <div className="bg-gray-900 p-3 rounded border border-gray-700">
            <p className="text-gray-300">{enhancedProfile}</p>
          </div>
        </div>
      )}
      
      {/* Section Improvements */}
      {Object.keys(improvements).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(improvements).map(([section, improvement]) => (
            <div key={section} className="bg-gray-900 p-3 rounded border border-gray-700">
              <h4 className="font-medium text-white mb-1 capitalize">{section}</h4>
              <p className="text-gray-300">{improvement}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 italic">No specific section improvements detected.</p>
      )}
    </div>
  );
} 