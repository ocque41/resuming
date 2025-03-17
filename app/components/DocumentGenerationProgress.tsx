'use client';

import React from 'react';
import { CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react';

interface DocumentGenerationProgressProps {
  progress: number;
  status: string;
  error: string | null;
  isGenerating: boolean;
}

const DocumentGenerationProgress: React.FC<DocumentGenerationProgressProps> = ({
  progress,
  status,
  error,
  isGenerating
}) => {
  // Define the steps in the document generation process
  const steps = [
    { name: 'Preparing document data', threshold: 10 },
    { name: 'Structuring CV content', threshold: 30 },
    { name: 'Generating document', threshold: 50 },
    { name: 'Preparing for download', threshold: 80 },
    { name: 'Downloading document', threshold: 90 },
    { name: 'Complete', threshold: 100 }
  ];

  // Determine the current step based on progress
  const currentStepIndex = steps.findIndex(step => progress < step.threshold);
  const activeStep = currentStepIndex === -1 ? steps.length - 1 : currentStepIndex - 1;

  return (
    <div className="w-full bg-[#0D0D0D] border border-[#333333] rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-white">Document Generation</h3>
        <span className="text-sm font-medium text-white">{progress}%</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-[#333333] rounded-full mb-4 overflow-hidden">
        <div 
          className="h-full transition-all duration-300 ease-in-out rounded-full"
          style={{ 
            width: `${progress}%`,
            backgroundColor: error ? '#ef4444' : progress === 100 ? '#22c55e' : '#B4916C'
          }}
        />
      </div>
      
      {/* Status message */}
      <p className="text-sm text-gray-300 mb-4">
        {error ? (
          <span className="text-red-400 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {error}
          </span>
        ) : (
          status || 'Preparing document...'
        )}
      </p>
      
      {/* Steps list */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          // Determine step status
          let StepIcon;
          let textColor;
          let lineColor;
          
          if (index < activeStep) {
            // Completed step
            StepIcon = CheckCircle;
            textColor = 'text-green-500';
            lineColor = 'border-green-500';
          } else if (index === activeStep) {
            // Current step
            StepIcon = isGenerating ? Clock : CheckCircle;
            textColor = isGenerating ? 'text-[#B4916C]' : 'text-green-500';
            lineColor = isGenerating ? 'border-[#B4916C]' : 'border-green-500';
          } else {
            // Future step
            StepIcon = Circle;
            textColor = 'text-gray-500';
            lineColor = 'border-gray-700';
          }
          
          return (
            <div key={step.name} className="flex items-start">
              <div className="flex-shrink-0 mr-2">
                <StepIcon className={`w-5 h-5 ${textColor}`} />
              </div>
              
              <div className="flex-1">
                <p className={`text-sm font-medium ${textColor}`}>{step.name}</p>
                
                {/* Only show connecting line if not the last step */}
                {index < steps.length - 1 && (
                  <div className={`ml-2 mt-1 h-6 border-l ${lineColor}`} />
                )}
              </div>
              
              <div className="flex-shrink-0 ml-2">
                <span className={`text-xs ${textColor}`}>{step.threshold}%</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Tips for users */}
      {isGenerating && (
        <div className="mt-4 p-3 bg-[#333333] rounded-md">
          <h4 className="text-sm font-medium text-white mb-1">Document Generation Tips</h4>
          <ul className="text-xs text-white list-disc pl-4 space-y-1">
            <li>Document generation typically takes 15-30 seconds</li>
            <li>Please don't refresh the page during generation, if it takes too long a reset button will appear</li>
            <li>It does not download automatically, use the manual download button</li>
            <li>The optimized document will not be automatically added to your CV collection, please download and upload it manually for further optimization, analysis, job application or document editing</li>
            <li>The final optimized document should have Profile, Experience, Achievements, Goals, Skills, Education and Summary sections. If you cannot see this sections well formatted in the structured view, try the optimization again, if after 2 to 4 tries you still not see this sections well formatted, your CV is missing key sections like Education, Experience or Skills</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentGenerationProgress; 