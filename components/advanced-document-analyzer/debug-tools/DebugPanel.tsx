import React from 'react';
import { Button } from '@/components/ui/button';
import { AnalysisResult } from '../types';

interface DebugPanelProps {
  analysisResults: AnalysisResult | null;
  analysisResultsRef: React.MutableRefObject<AnalysisResult | null>;
  selectedDocumentId: string | null;
  analysisType: string;
  isAnalyzing: boolean;
  forceUpdateCounter: number;
  onLogState: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  analysisResults,
  analysisResultsRef,
  selectedDocumentId,
  analysisType,
  isAnalyzing,
  forceUpdateCounter,
  onLogState
}) => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="text-xs text-gray-500 mt-2 opacity-70 p-2 bg-gray-900 rounded-md">
      <div className="font-semibold mb-1">Debug Info:</div>
      <div>Results state: {analysisResults ? 'Available in state' : 'Not in state'}</div>
      <div>Ref: {analysisResultsRef.current ? 'Available in ref' : 'Not in ref'}</div>
      <div>Counter: {forceUpdateCounter}</div>
      <div>Selected Document ID: {selectedDocumentId || 'None'}</div>
      <div>Analysis Type: {analysisType}</div>
      <div>Is Analyzing: {isAnalyzing ? 'Yes' : 'No'}</div>
      <div>Has Results: {analysisResultsRef.current || analysisResults ? 'Yes' : 'No'}</div>
      
      <div className="flex gap-2 mt-2">
        <button 
          className="text-purple-400 hover:text-purple-300 underline px-2 py-1"
          onClick={onLogState}
        >
          Log State
        </button>
        
        <button 
          className="text-blue-400 hover:text-blue-300 underline px-2 py-1"
          onClick={() => {
            // Force DOM update
            window.dispatchEvent(new Event('resize'));
            console.log("Triggered window resize to force UI update");
          }}
        >
          Force Reflow
        </button>
        
        {analysisResults && (
          <button 
            className="text-green-400 hover:text-green-300 underline px-2 py-1"
            onClick={() => {
              console.log("ANALYSIS RESULTS:", analysisResults);
            }}
          >
            Log Results
          </button>
        )}
      </div>
      
      {analysisResultsRef.current && !analysisResults && (
        <div className="mt-2 text-orange-400">
          Warning: Results are in ref but not in state!
          <button 
            className="ml-2 text-green-400 hover:text-green-300 underline px-2 py-1"
            onClick={() => {
              // This could help diagnose state synchronization issues
              const event = new CustomEvent('document-analysis-complete', { 
                detail: { documentId: selectedDocumentId, success: true } 
              });
              document.dispatchEvent(event);
              console.log("Dispatched document-analysis-complete event manually");
            }}
          >
            Trigger Update Event
          </button>
        </div>
      )}
    </div>
  );
};

export default DebugPanel; 