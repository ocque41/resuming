import { useState } from 'react';

// Type definitions
interface KeywordMatch {
  keyword: string;
  relevance: number;
  frequency: number;
  placement: string;
}

interface MissingKeyword {
  keyword: string;
  importance: number;
  suggestedPlacement: string;
}

interface JobMatchAnalysis {
  score: number;
  matchedKeywords: KeywordMatch[];
  missingKeywords: MissingKeyword[];
  recommendations: string[];
  skillGap: string;
  dimensionalScores: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    industryFit: number;
    overallCompatibility: number;
    keywordDensity: number;
    formatCompatibility: number;
    contentRelevance: number;
  };
  detailedAnalysis: string;
  improvementPotential: number;
  sectionAnalysis: {
    profile: { score: number; feedback: string };
    skills: { score: number; feedback: string };
    experience: { score: number; feedback: string };
    education: { score: number; feedback: string };
    achievements: { score: number; feedback: string };
  };
}

// Job Match Detailed Analysis Component
const JobMatchDetailedAnalysis = ({ jobMatchAnalysis }: { jobMatchAnalysis: JobMatchAnalysis }) => {
  const [activeTab, setActiveTab] = useState('keywords');
  
  return (
    <div className="mt-6">
      <div className="border-b border-gray-700 mb-4">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button 
              className={`inline-block py-2 px-4 border-b-2 ${activeTab === 'keywords' ? 'border-[#B4916C] text-[#B4916C]' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}
              onClick={() => setActiveTab('keywords')}
            >
              Keywords
            </button>
          </li>
          <li className="mr-2">
            <button 
              className={`inline-block py-2 px-4 border-b-2 ${activeTab === 'skillGap' ? 'border-[#B4916C] text-[#B4916C]' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}
              onClick={() => setActiveTab('skillGap')}
            >
              Skill Gap
            </button>
          </li>
          <li className="mr-2">
            <button 
              className={`inline-block py-2 px-4 border-b-2 ${activeTab === 'sections' ? 'border-[#B4916C] text-[#B4916C]' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}
              onClick={() => setActiveTab('sections')}
            >
              Section Analysis
            </button>
          </li>
          <li>
            <button 
              className={`inline-block py-2 px-4 border-b-2 ${activeTab === 'recommendations' ? 'border-[#B4916C] text-[#B4916C]' : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}`}
              onClick={() => setActiveTab('recommendations')}
            >
              Recommendations
            </button>
          </li>
        </ul>
      </div>
      
      {/* Keywords Tab */}
      {activeTab === 'keywords' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Matched Keywords */}
          <div className="border border-gray-700 rounded-md p-4">
            <h4 className="text-lg font-medium mb-3 flex items-center">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              Matched Keywords ({jobMatchAnalysis.matchedKeywords.length})
            </h4>
            
            {jobMatchAnalysis.matchedKeywords.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {jobMatchAnalysis.matchedKeywords
                    .sort((a, b) => b.relevance - a.relevance)
                    .slice(0, 15) // Only show top 15 most relevant keywords
                    .map((keyword, index) => (
                      <span 
                        key={index} 
                        className="px-2 py-1 rounded text-sm"
                        style={{ 
                          backgroundColor: `rgba(34, 197, 94, ${keyword.relevance / 100})`,
                          color: keyword.relevance > 50 ? '#000' : '#fff',
                          border: '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                        title={`Relevance: ${keyword.relevance}%, Frequency: ${keyword.frequency}, Placement: ${keyword.placement}`}
                      >
                        {keyword.keyword}
                      </span>
                    ))
                  }
                </div>
                {jobMatchAnalysis.matchedKeywords.length > 15 && (
                  <p className="text-gray-400 text-xs mt-2">
                    Showing top 15 of {jobMatchAnalysis.matchedKeywords.length} matched keywords by relevance
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">No matching keywords found.</p>
            )}
          </div>
          
          {/* Missing Keywords */}
          <div className="border border-gray-700 rounded-md p-4">
            <h4 className="text-lg font-medium mb-3 flex items-center">
              <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
              Missing Keywords ({jobMatchAnalysis.missingKeywords.length})
            </h4>
            
            {jobMatchAnalysis.missingKeywords.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {jobMatchAnalysis.missingKeywords
                    .sort((a, b) => b.importance - a.importance)
                    .slice(0, 10) // Only show top 10 most important keywords
                    .map((keyword, index) => (
                      <span 
                        key={index} 
                        className="px-2 py-1 rounded text-sm"
                        style={{ 
                          backgroundColor: `rgba(239, 68, 68, ${keyword.importance / 100})`,
                          color: keyword.importance > 50 ? '#000' : '#fff',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                        title={`Importance: ${keyword.importance}%, Suggested Placement: ${keyword.suggestedPlacement}`}
                      >
                        {keyword.keyword}
                      </span>
                    ))
                  }
                </div>
                {jobMatchAnalysis.missingKeywords.length > 10 && (
                  <p className="text-gray-400 text-xs mt-2">
                    Showing top 10 of {jobMatchAnalysis.missingKeywords.length} missing keywords by importance
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">No missing keywords found.</p>
            )}
          </div>
        </div>
      )}
      
      {/* Skill Gap Tab */}
      {activeTab === 'skillGap' && (
        <div className="border border-gray-700 rounded-md p-4">
          <h4 className="text-lg font-medium mb-3">Skill Gap Analysis</h4>
          <p className="text-gray-300 whitespace-pre-line">{jobMatchAnalysis.skillGap}</p>
        </div>
      )}
      
      {/* Section Analysis Tab */}
      {activeTab === 'sections' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(jobMatchAnalysis.sectionAnalysis).map(([section, analysis]) => (
            <div key={section} className="border border-gray-700 rounded-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium capitalize">{section}</h5>
                <span 
                  className="px-2 py-1 text-xs rounded-full"
                  style={{
                    backgroundColor: analysis.score >= 70 ? 'rgba(34, 197, 94, 0.2)' : 
                                    analysis.score >= 50 ? 'rgba(234, 179, 8, 0.2)' : 
                                    'rgba(239, 68, 68, 0.2)',
                    color: analysis.score >= 70 ? 'rgb(34, 197, 94)' : 
                          analysis.score >= 50 ? 'rgb(234, 179, 8)' : 
                          'rgb(239, 68, 68)'
                  }}
                >
                  {analysis.score}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full" style={{ 
                  width: `${analysis.score}%`,
                  backgroundColor: analysis.score >= 70 ? '#22c55e' : 
                                  analysis.score >= 50 ? '#eab308' : 
                                  '#ef4444'
                }}></div>
              </div>
              <p className="text-sm text-gray-300">{analysis.feedback}</p>
            </div>
          ))}
        </div>
      )}
      
      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="border border-gray-700 rounded-md p-4">
          <h4 className="text-lg font-medium mb-3 flex items-center">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </span>
            Recommendations
          </h4>
          <ul className="list-disc pl-5 space-y-2 text-gray-300">
            {jobMatchAnalysis.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default JobMatchDetailedAnalysis; 