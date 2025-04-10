"use client";

import React, { useState, useEffect, useRef } from "react";
import { Tabs, Progress, Empty, List, Avatar, Card } from "antd";
import { 
  DownloadOutlined, 
  ShareAltOutlined, 
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileWordOutlined,
  FileUnknownOutlined
} from "@ant-design/icons";
import { detectFileType, getAnalysisTypeForFile, FileTypeInfo, isPdfFile } from "@/lib/file-utils/file-type-detector";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
// @ts-ignore
import jsPDF from "jspdf";
// @ts-ignore
import html2canvas from "html2canvas";

// Define the DocumentWithId interface
export interface DocumentWithId {
  id: string;
  name: string;
  fileName: string;
  createdAt: Date;
}

// Define TabPane and Panel using destructuring
const { TabPane } = Tabs;

interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

interface DocumentAnalyzerProps {
  documents: Document[];
}

// Custom document purpose selector component
const DocumentPurposeSelector = ({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="mb-4">
      <label className="block mb-2 text-[#F9F6EE] font-borna">Document Purpose</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => onChange('general')}
          className={`px-3 py-2 rounded-md text-center text-sm ${
            value === 'general' 
              ? 'bg-[#B4916C] text-white' 
              : 'bg-[#171717] text-[#F9F6EE] hover:bg-[#222222]'
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => onChange('cv')}
          className={`px-3 py-2 rounded-md text-center text-sm ${
            value === 'cv' 
              ? 'bg-[#B4916C] text-white' 
              : 'bg-[#171717] text-[#F9F6EE] hover:bg-[#222222]'
          }`}
        >
          CV / Resume
        </button>
        <button
          type="button"
          onClick={() => onChange('spreadsheet')}
          className={`px-3 py-2 rounded-md text-center text-sm ${
            value === 'spreadsheet' 
              ? 'bg-[#B4916C] text-white' 
              : 'bg-[#171717] text-[#F9F6EE] hover:bg-[#222222]'
          }`}
        >
          Spreadsheet
        </button>
        <button
          type="button"
          onClick={() => onChange('presentation')}
          className={`px-3 py-2 rounded-md text-center text-sm ${
            value === 'presentation' 
              ? 'bg-[#B4916C] text-white' 
              : 'bg-[#171717] text-[#F9F6EE] hover:bg-[#222222]'
          }`}
        >
          Presentation
        </button>
      </div>
    </div>
  );
};

// Replace Select with our custom styled dropdown
const DocSelector = ({ documents, value, onChange }: {
  documents: Document[];
  value: string | null;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="relative">
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 md:py-2 bg-[#111111] border border-[#222222] rounded-md text-[#F9F6EE] font-borna appearance-none focus:outline-none focus:ring-2 focus:ring-[#B4916C] focus:border-transparent max-sm:text-base"
      >
        <option value="" disabled>Select a document to analyze</option>
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id} className="py-2">
            {doc.fileName}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg className="w-5 h-5 text-[#B4916C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

// Loading spinner component
const LoadingSpinner = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-10 h-10 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin mb-4"></div>
    <p className="text-[#F9F6EE]">{text}</p>
  </div>
);

// Empty state component
const EmptyDocumentState = () => (
  <div className="flex flex-col items-center justify-center py-12 bg-[#111111] border border-[#222222] rounded-md">
    <svg className="w-16 h-16 text-[#333333] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <h4 className="text-[#F9F6EE] font-medium mb-2">No analysis yet</h4>
    <p className="text-[#8A8782] text-center max-w-md">
      Select a document and click "Analyze Document" to generate an analysis.
    </p>
  </div>
);

// Add the missing types for the map functions
// For keywords
const renderKeywordChips = (keywords: string[]) => (
  <div className="flex flex-wrap gap-2 mt-2">
    {keywords.map((keyword: string, index: number) => (
      <div key={index} className="px-3 py-1 bg-[#1A1A1A] text-[#F9F6EE] rounded-full text-xs">
        {keyword}
      </div>
    ))}
  </div>
);

// For missing keywords
const renderMissingKeywords = (keywords: string[]) => (
  <div className="flex flex-wrap gap-2 mt-2">
    {keywords.map((keyword: string, index: number) => (
      <div key={index} className="px-3 py-1 bg-[#1A1A1A] text-[#F9F6EE]/60 border border-[#333333] rounded-full text-xs flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        {keyword}
      </div>
    ))}
  </div>
);

// For skill titles
const renderSkillTitles = (titles: string[]) => (
  <div className="flex flex-wrap gap-2 mt-3">
    {titles.map((title: string, index: number) => (
      <div key={index} className="px-3 py-1 bg-[#1A1A1A] text-[#F9F6EE] rounded-full text-xs font-medium">
        {title}
      </div>
    ))}
  </div>
);

// For issues
const renderIssueItems = (issues: Array<{title: string; description: string}>) => (
  <div className="space-y-3 mt-3">
    {issues.map((issue: {title: string; description: string}, index: number) => (
      <div key={index} className="p-3 bg-[#1A1A1A] rounded-md">
        <div className="font-medium text-[#F9F6EE]">{issue.title}</div>
        <div className="text-[#F9F6EE]/70 text-sm mt-1">{issue.description}</div>
      </div>
    ))}
  </div>
);

// For suggestions
const renderSuggestionItems = (suggestions: Array<{title: string; description: string}>) => (
  <div className="space-y-3 mt-3">
    {suggestions.map((suggestion: {title: string; description: string}, index: number) => (
      <div key={index} className="p-3 bg-[#171717] border border-[#222222] rounded-md">
        <div className="font-medium text-[#B4916C]">{suggestion.title}</div>
        <div className="text-[#F9F6EE]/70 text-sm mt-1">{suggestion.description}</div>
      </div>
    ))}
  </div>
);

const renderCVAnalysis = (analysisData: any) => {
  // Handle possible format differences in the response
  const cvAnalysis = analysisData.cvAnalysis || analysisData;
  const summary = analysisData.summary || {};
  
  // Extract fields with fallbacks
  const relevantJobTitles = 
    cvAnalysis.marketFit?.targetRoleRecommendations || 
    summary.marketFit?.targetRoleRecommendations || 
    ["No job titles available"];
  
  const allSkills = 
    (cvAnalysis.skills?.technical || [])
      .map((skill: any) => skill.name || skill)
      .concat(
        (cvAnalysis.skills?.soft || [])
          .map((skill: any) => skill.name || skill)
      )
      .concat(
        (cvAnalysis.skills?.domain || [])
          .map((skill: any) => skill.name || skill)
      ) || 
    ["No skills detected"];
  
  const jobSpecificSkills = 
    (cvAnalysis.skills?.domain || [])
      .filter((skill: any) => (skill.relevance || 0) > 7)
      .map((skill: any) => skill.name || skill) || 
    ["No job-specific skills detected"];
  
  const resumeKeywords = 
    (analysisData.contentAnalysis?.topKeywords || [])
      .map((kw: any) => kw.text || kw) || 
    ["No keywords detected"];
  
  const missingKeywords = 
    (cvAnalysis.atsCompatibility?.improvementAreas || [])
      .filter((area: string) => area.toLowerCase().includes('keyword') || area.toLowerCase().includes('term')) || 
    ["Consider industry-specific terminology"];
  
  // Structure strength/weakness data
  const strengthsWeaknesses = {
    strengths: (cvAnalysis.strengths || summary.highlights || [])
      .map((str: string) => ({ 
        title: str.split(':')[0] || str, 
        description: str.split(':')[1] || '' 
      })),
    weaknesses: (cvAnalysis.weaknesses || [])
      .map((str: string) => ({ 
        title: str.split(':')[0] || str, 
        description: str.split(':')[1] || '' 
      }))
  };
  
  // Format improvement suggestions
  const improvementSuggestions = 
    (summary.suggestions || [])
      .map((sug: string) => ({ 
        title: sug.split(':')[0] || sug, 
        description: sug.split(':')[1] || ''
      }));

  return (
    <div className="space-y-4">
      {/* Relevant Job Titles */}
      <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
        <h3 className="text-lg font-medium text-[#F9F6EE] mb-2">Relevant Job Titles</h3>
        <p className="text-[#8A8782] text-sm mb-2">Job roles your CV is most suited for based on your skills and experience.</p>
        {renderSkillTitles(relevantJobTitles)}
      </div>

      {/* Skills Analysis */}
      <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
        <h3 className="text-lg font-medium text-[#F9F6EE] mb-2">Skills Analysis</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-[#F9F6EE] font-medium">All Skills Detected</h4>
            <p className="text-[#8A8782] text-sm mb-1">All skills identified in your CV.</p>
            {renderKeywordChips(allSkills)}
          </div>
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Job-Specific Skills</h4>
            <p className="text-[#8A8782] text-sm mb-1">Skills that are particularly relevant to your target roles.</p>
            {renderKeywordChips(jobSpecificSkills)}
          </div>
        </div>
      </div>

      {/* Keywords Analysis */}
      <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
        <h3 className="text-lg font-medium text-[#F9F6EE] mb-2">Keywords Analysis</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Resume Keywords</h4>
            <p className="text-[#8A8782] text-sm mb-1">Important keywords found in your CV.</p>
            {renderKeywordChips(resumeKeywords)}
          </div>
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Missing Keywords</h4>
            <p className="text-[#8A8782] text-sm mb-1">Relevant keywords that could strengthen your CV.</p>
            {renderMissingKeywords(missingKeywords)}
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
        <h3 className="text-lg font-medium text-[#F9F6EE] mb-2">Strengths & Weaknesses</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Strengths</h4>
            {renderIssueItems(strengthsWeaknesses.strengths)}
          </div>
          <div>
            <h4 className="text-[#F9F6EE] font-medium">Areas for Improvement</h4>
            {renderIssueItems(strengthsWeaknesses.weaknesses)}
          </div>
        </div>
      </div>

      {/* Improvement Suggestions */}
      <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
        <h3 className="text-lg font-medium text-[#F9F6EE] mb-2">Improvement Suggestions</h3>
        <p className="text-[#8A8782] text-sm mb-2">Actionable steps to enhance your CV.</p>
        {renderSuggestionItems(improvementSuggestions)}
      </div>
    </div>
  );
};

const DocumentAnalyzer = ({ documents }: { documents: DocumentWithId[] }) => {
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithId | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [documentPurpose, setDocumentPurpose] = useState<string>("");
  const [tabKey, setTabKey] = useState<string>("summary");
  const analysisRef = useRef<HTMLDivElement>(null);
  const [feedbackType, setFeedbackType] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  
  const handleAnalyzeDocument = async () => {
    if (!documentPurpose) {
      setError("Please select a document purpose");
      return;
    }

    if (!selectedDocument) {
      setError("Please select a document");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch document text - try multiple methods
      let documentText = '';
      let fetchSuccess = false;
      
      console.log(`Attempting to fetch document ID: ${selectedDocument.id}, fileName: ${selectedDocument.fileName || 'unknown'}`);
      
      // Method 1: Try using get-text endpoint first
      try {
        console.log("Method 1: Using /api/cv/get-text endpoint");
        const response = await fetch(`/api/cv/get-text?cvId=${selectedDocument.id}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.text && data.text.length > 0) {
            documentText = data.text;
            fetchSuccess = true;
            console.log(`Successfully fetched document text using get-text endpoint (${documentText.length} characters)`);
          }
        } else {
          console.warn(`get-text endpoint failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error("Error using get-text endpoint:", error);
      }
      
      // Method 2: If first method failed, try the document details endpoint
      if (!fetchSuccess) {
        try {
          console.log("Method 2: Using /api/cv/get-details endpoint");
          const response = await fetch(`/api/cv/get-details?cvId=${selectedDocument.id}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.rawText && data.rawText.length > 0) {
              documentText = data.rawText;
              fetchSuccess = true;
              console.log(`Successfully fetched document text using get-details endpoint (${documentText.length} characters)`);
            }
          } else {
            console.warn(`get-details endpoint failed: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error("Error using get-details endpoint:", error);
        }
      }
      
      // Method 3: If both methods failed, try the documents endpoint
      if (!fetchSuccess) {
        try {
          console.log("Method 3: Using /api/documents/[id] endpoint");
          const response = await fetch(`/api/documents/${selectedDocument.id}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.document && data.document.content) {
              documentText = data.document.content;
              fetchSuccess = true;
              console.log(`Successfully fetched document text using documents endpoint (${documentText.length} characters)`);
            } else if (data.document && data.document.text) {
              // Alternative field name that might contain the text
              documentText = data.document.text;
              fetchSuccess = true;
              console.log(`Successfully fetched document text (from text field) using documents endpoint (${documentText.length} characters)`);
            }
          } else {
            console.warn(`documents endpoint failed: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error("Error using documents endpoint:", error);
        }
      }
      
      // Method 4: Try a generic document content endpoint as last resort
      if (!fetchSuccess) {
        try {
          console.log("Method 4: Using /api/documents/content endpoint");
          const response = await fetch(`/api/documents/content?id=${selectedDocument.id}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.content && data.content.length > 0) {
              documentText = data.content;
              fetchSuccess = true;
              console.log(`Successfully fetched document text using content endpoint (${documentText.length} characters)`);
            }
          } else {
            console.warn(`document content endpoint failed: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error("Error using document content endpoint:", error);
        }
      }
      
      // If all methods failed, throw an error
      if (!fetchSuccess || !documentText) {
        throw new Error("Could not retrieve document text content. Please ensure the document has been processed correctly and contains extractable text.");
      }
      
      console.log(`Document text fetched successfully (${documentText.length} characters). Sending for analysis...`);
      
      // Send document for analysis
      const response = await fetch("/api/document/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          documentText: documentText,
          fileName: selectedDocument.fileName || 'document',
          documentPurpose: documentPurpose,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || response.statusText;
        console.error(`Analysis failed: ${response.status} ${errorMessage}`);
        throw new Error(`Analysis failed: ${errorMessage}`);
      }

      const data = await response.json();
      console.log("Analysis completed successfully");
      setAnalysisData(data.analysis);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error analyzing document:", errorMessage);
      setError(errorMessage || "Failed to analyze document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!analysisRef.current || !analysisData || !selectedDocument) return;
    
    setLoading(true);
    try {
      // Create a wrapper div with full black background to prevent white lines
      const wrapper = document.createElement('div');
      wrapper.style.backgroundColor = '#111111';
      wrapper.style.padding = '20px';
      wrapper.style.paddingBottom = '40px'; // Extra padding at bottom to prevent white line
      wrapper.appendChild(analysisRef.current.cloneNode(true));
      document.body.appendChild(wrapper);
      
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: "#111111",
        logging: false,
        useCORS: true,
        allowTaint: true,
        height: wrapper.scrollHeight + 40, // Add extra height to ensure full capture
        windowHeight: wrapper.scrollHeight + 40
      });
      
      document.body.removeChild(wrapper);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      // Set background color for all pages
      pdf.setFillColor(17, 17, 17); // #111111
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add background rectangle to first page
      pdf.rect(0, 0, 210, 297, 'F');
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        // Add background rectangle to each new page
        pdf.rect(0, 0, 210, 297, 'F');
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${selectedDocument.name.replace(/\.[^/.]+$/, "")}_analysis.pdf`);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      setError("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to render cover letter analysis
  const renderCoverLetterAnalysis = (analysisData: any) => {
    // Simple placeholder until we implement the detailed cover letter analysis
    return (
      <div className="p-4">
        <h3 className="text-lg font-bold text-[#F9F6EE] mb-4">Cover Letter Analysis</h3>
        <p className="text-[#F9F6EE]">Cover letter analysis results will be displayed here.</p>
      </div>
    );
  };

  // Helper function to render job description analysis
  const renderJobDescriptionAnalysis = (analysisData: any) => {
    // Simple placeholder until we implement the detailed job description analysis
    return (
      <div className="p-4">
        <h3 className="text-lg font-bold text-[#F9F6EE] mb-4">Job Description Analysis</h3>
        <p className="text-[#F9F6EE]">Job description analysis results will be displayed here.</p>
      </div>
    );
  };
  
  const handleFeedback = (type: string) => {
    setFeedbackType(type);
    
    // For quick feedback types (accurate and helpful), submit immediately
    if (type === 'accurate' || type === 'helpful') {
      submitFeedback(type, '');
    }
  };

  const submitFeedback = async (type: string, feedbackText: string = '') => {
    if (!analysisData || !selectedDocument) return;
    
    try {
      const response = await fetch('/api/document/analyze/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          analysisType: documentPurpose,
          rating: type === 'accurate' ? 5 : type === 'helpful' ? 4 : 2,
          feedbackText: feedbackText
        }),
      });
      
      if (response.ok) {
        setFeedbackSubmitted(true);
        // Reset the feedback form after 3 seconds
        setTimeout(() => {
          setFeedbackSubmitted(false);
          setFeedbackType(null);
          setFeedbackText('');
        }, 3000);
      } else {
        console.error('Failed to submit feedback');
        setError('Failed to submit feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Error submitting feedback');
    }
  };

  const submitDetailedFeedback = () => {
    if (feedbackType === 'needs_improvement' && feedbackText.trim()) {
      submitFeedback(feedbackType, feedbackText);
    }
  };

  // Helper function to render spreadsheet analysis
  const renderSpreadsheetAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-4">
        <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
          <h3 className="text-lg font-medium text-[#F9F6EE] mb-3">Spreadsheet Analysis</h3>
          <p className="text-[#F9F6EE]/70 mb-4">{analysisData.summary || "Analysis of spreadsheet data structure and content."}</p>
          
          {/* Data Structure Analysis */}
          {analysisData.dataStructureAnalysis && (
            <div className="mt-4">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Data Structure</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Tables</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.dataStructureAnalysis.tableCount || "N/A"}</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Columns</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.dataStructureAnalysis.columnCount || "N/A"}</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Rows</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.dataStructureAnalysis.rowCount || "N/A"}</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Data Types</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{Array.isArray(analysisData.dataStructureAnalysis.dataTypes) ? analysisData.dataStructureAnalysis.dataTypes.join(", ") : "Various"}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Data Insights */}
          {analysisData.dataInsights && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Key Insights</h4>
              <div className="space-y-3">
                {analysisData.dataInsights.trends && analysisData.dataInsights.trends.map((trend: any, index: number) => (
                  <div key={`trend-${index}`} className="p-3 bg-[#171717] rounded-md">
                    <div className="flex justify-between">
                      <p className="text-[#F9F6EE] font-medium">{trend.description}</p>
                      <span className="px-2 py-0.5 bg-[#B4916C]/20 text-[#B4916C] rounded text-xs">{trend.significance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Data Quality */}
          {analysisData.dataQualityAssessment && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Data Quality</h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Completeness</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.dataQualityAssessment.completenessScore || "N/A"}%</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Consistency</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.dataQualityAssessment.consistencyScore || "N/A"}%</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Accuracy</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.dataQualityAssessment.accuracyScore || "N/A"}%</p>
                </div>
              </div>
              
              <h5 className="text-[#F9F6EE]/80 text-sm font-medium mb-2">Quality Issues</h5>
              <div className="space-y-2">
                {analysisData.dataQualityAssessment.qualityIssues && analysisData.dataQualityAssessment.qualityIssues.map((issue: any, index: number) => (
                  <div key={`issue-${index}`} className="p-3 bg-[#171717] rounded-md">
                    <div className="flex justify-between mb-1">
                      <p className="text-[#F9F6EE] font-medium">{issue.issue}</p>
                      <span className={`px-2 py-0.5 rounded text-xs ${issue.severity === 'high' ? 'bg-red-900/20 text-red-400' : issue.severity === 'medium' ? 'bg-yellow-900/20 text-yellow-400' : 'bg-[#222222] text-[#8A8782]'}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-[#8A8782] text-sm">{issue.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Helper function to render presentation analysis
  const renderPresentationAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-4">
        <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
          <h3 className="text-lg font-medium text-[#F9F6EE] mb-3">Presentation Analysis</h3>
          <p className="text-[#F9F6EE]/70 mb-4">{analysisData.summary || "Analysis of presentation structure, content, and effectiveness."}</p>
          
          {/* Key Points */}
          <div className="mt-4">
            <h4 className="text-[#F9F6EE] font-medium mb-2">Key Points</h4>
            <ul className="list-disc list-inside space-y-1 pl-2 text-[#F9F6EE]/80">
              {(analysisData.keyPoints || ["No key points detected"]).map((point: string, index: number) => (
                <li key={`point-${index}`}>{point}</li>
              ))}
            </ul>
          </div>
          
          {/* Presentation Structure */}
          {analysisData.presentationStructure && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Structure Analysis</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Estimated Slides</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.presentationStructure.estimatedSlideCount || "Unknown"}</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Narrative Flow</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.presentationStructure.narrativeFlow || "N/A"}/100</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md flex items-center">
                  <div>
                    <p className="text-[#8A8782] text-xs">Has Introduction</p>
                    <p className="text-[#F9F6EE] font-medium">
                      {analysisData.presentationStructure.hasIntroduction ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-[#171717] rounded-md flex items-center">
                  <div>
                    <p className="text-[#8A8782] text-xs">Has Conclusion</p>
                    <p className="text-[#F9F6EE] font-medium">
                      {analysisData.presentationStructure.hasConclusion ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Message Clarity */}
          {analysisData.messageClarity && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Message Clarity</h4>
              <div className="p-3 bg-[#171717] rounded-md mb-3">
                <p className="text-[#8A8782] text-xs mb-1">Main Message</p>
                <p className="text-[#F9F6EE]">{analysisData.messageClarity.mainMessage || "No clear main message detected"}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Clarity Score</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.messageClarity.clarity || "N/A"}/100</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Target Audience</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.messageClarity.audienceAlignment || "General"}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Improvement Suggestions */}
          <div className="mt-5">
            <h4 className="text-[#F9F6EE] font-medium mb-2">Improvement Suggestions</h4>
            <div className="space-y-2">
              {(analysisData.recommendations || analysisData.improvementSuggestions?.content || ["No specific recommendations"]).map((rec: any, index: number) => (
                <div key={`rec-${index}`} className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#F9F6EE]">{typeof rec === 'string' ? rec : rec.title || rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render scientific document analysis
  const renderScientificAnalysis = (analysisData: any) => {
    return (
      <div className="space-y-4">
        <div className="p-5 border border-[#222222] rounded-lg bg-[#111111]">
          <h3 className="text-lg font-medium text-[#F9F6EE] mb-3">Scientific Document Analysis</h3>
          <p className="text-[#F9F6EE]/70 mb-4">{analysisData.summary || "Analysis of scientific research content and structure."}</p>
          
          {/* Research Structure */}
          {analysisData.researchStructure && (
            <div className="mt-4">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Research Structure</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="p-3 bg-[#171717] rounded-md flex items-center">
                  <div>
                    <p className="text-[#8A8782] text-xs">Abstract</p>
                    <p className="text-[#F9F6EE] font-medium">
                      {analysisData.researchStructure.hasAbstract ? "Present" : "Missing"}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-[#171717] rounded-md flex items-center">
                  <div>
                    <p className="text-[#8A8782] text-xs">Methodology</p>
                    <p className="text-[#F9F6EE] font-medium">
                      {analysisData.researchStructure.hasMethodology ? "Present" : "Missing"}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-[#171717] rounded-md flex items-center">
                  <div>
                    <p className="text-[#8A8782] text-xs">Results</p>
                    <p className="text-[#F9F6EE] font-medium">
                      {analysisData.researchStructure.hasResults ? "Present" : "Missing"}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-[#171717] rounded-md flex items-center">
                  <div>
                    <p className="text-[#8A8782] text-xs">References</p>
                    <p className="text-[#F9F6EE] font-medium">
                      {analysisData.researchStructure.hasReferences ? "Present" : "Missing"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Key Points */}
          <div className="mt-5">
            <h4 className="text-[#F9F6EE] font-medium mb-2">Key Findings</h4>
            <ul className="list-disc list-inside space-y-1 pl-2 text-[#F9F6EE]/80">
              {(analysisData.keyPoints || ["No key findings detected"]).map((point: string, index: number) => (
                <li key={`finding-${index}`}>{point}</li>
              ))}
            </ul>
          </div>
          
          {/* Research Quality */}
          {analysisData.researchQuality && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Research Quality</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Methodology Rigor</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.researchQuality.methodologyRigor || "N/A"}/100</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Data Quality</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.researchQuality.dataQuality || "N/A"}/100</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Analysis Depth</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.researchQuality.analysisDepth || "N/A"}/100</p>
                </div>
                <div className="p-3 bg-[#171717] rounded-md">
                  <p className="text-[#8A8782] text-xs">Originality</p>
                  <p className="text-[#F9F6EE] text-lg font-medium">{analysisData.researchQuality.originalityScore || "N/A"}/100</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Research Gaps */}
          {analysisData.researchGaps && analysisData.researchGaps.length > 0 && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Research Gaps</h4>
              <ul className="list-disc list-inside space-y-1 pl-2 text-[#F9F6EE]/80">
                {analysisData.researchGaps.map((gap: string, index: number) => (
                  <li key={`gap-${index}`}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Topics */}
          {analysisData.topics && analysisData.topics.length > 0 && (
            <div className="mt-5">
              <h4 className="text-[#F9F6EE] font-medium mb-2">Research Topics</h4>
              <div className="flex flex-wrap gap-2">
                {analysisData.topics.map((topic: any, index: number) => (
                  <div key={`topic-${index}`} className="px-3 py-1 bg-[#1A1A1A] text-[#F9F6EE] rounded-full text-xs flex items-center">
                    {topic.name || topic}
                    {topic.relevance && (
                      <span className="ml-1 px-1.5 py-0.5 bg-[#B4916C]/20 text-[#B4916C] rounded-full text-xs">
                        {Number(topic.relevance * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Document Selection & Purpose */}
      <div className="mb-6 space-y-4">
        <DocSelector 
          documents={documents}
          value={selectedDocument?.id || null}
          onChange={(docId) => {
            const doc = documents.find(d => d.id === docId);
            setSelectedDocument(doc || null);
          }}
        />
        
        {selectedDocument && (
          <DocumentPurposeSelector
            value={documentPurpose}
            onChange={setDocumentPurpose}
          />
        )}
        
        {selectedDocument && (
          <button
            onClick={handleAnalyzeDocument}
            disabled={loading || !documentPurpose}
            className={`w-full p-3 rounded-lg text-white font-borna flex items-center justify-center ${
              loading || !documentPurpose
                ? 'bg-[#333333] cursor-not-allowed'
                : 'bg-[#B4916C] hover:bg-[#9A7B5F] cursor-pointer'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>Analyze Document</>
            )}
          </button>
        )}
        
        {error && (
          <div className="p-3 mt-3 bg-red-900/20 border border-red-900/30 text-red-400 rounded-lg">
            {error}
          </div>
        )}
      </div>
      
      {loading && !analysisData && (
        <LoadingSpinner text="Analyzing document. This may take a minute..." />
      )}
      
      {!loading && !analysisData && !error && (
        <EmptyDocumentState />
      )}
      
      {analysisData && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#F9F6EE]">Analysis Results</h2>
            <button
              onClick={handleExportPDF}
              disabled={loading}
              className="px-4 py-2 bg-[#B4916C] text-white rounded-lg flex items-center hover:bg-[#9A7B5F] transition-colors"
            >
              <FileTextOutlined className="mr-2" />
              Export as PDF
            </button>
          </div>
          
          <div ref={analysisRef} className="bg-[#111111] text-[#F9F6EE] p-4 rounded-lg">
            {/* Render analysis based on document type */}
            {documentPurpose.toLowerCase() === "cv" && renderCVAnalysis(analysisData)}
            {documentPurpose.toLowerCase() === "general" && renderCVAnalysis(analysisData)}
            {documentPurpose.toLowerCase() === "cover letter" && renderCoverLetterAnalysis(analysisData)}
            {documentPurpose.toLowerCase() === "job description" && renderJobDescriptionAnalysis(analysisData)}
            {documentPurpose.toLowerCase() === "spreadsheet" && renderSpreadsheetAnalysis(analysisData)}
            {documentPurpose.toLowerCase() === "presentation" && renderPresentationAnalysis(analysisData)}
            {documentPurpose.toLowerCase() === "scientific" && renderScientificAnalysis(analysisData)}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentAnalyzer;
  