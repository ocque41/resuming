"use client";

import React, { useState } from "react";
import { Select, Button, Alert, Spin, Tabs, Card, Progress, Collapse, Empty, Tooltip, List, Avatar } from "antd";
import { 
  PieChart, 
  Pie, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PolarRadiusAxis
} from "recharts";
import { 
  FileTextOutlined, 
  FileExcelOutlined, 
  FilePptOutlined, 
  DownloadOutlined, 
  ShareAltOutlined,
  CheckOutlined
} from "@ant-design/icons";
import { detectFileType, getAnalysisTypeForFile, FileTypeInfo, isPdfFile } from "@/lib/file-utils/file-type-detector";

// Define TabPane and Panel using destructuring
const { TabPane } = Tabs;
const { Panel } = Collapse;

// Color palette for charts
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

interface DocumentAnalyzerProps {
  documents: Document[];
}

// Document purpose options with more detailed tooltips
const documentPurposes = [
  { 
    value: "general", 
    label: "General Document", 
    description: "Standard text document analysis", 
    tooltip: "Best for regular documents like articles, reports, letters, and other text-focused content."
  },
  { 
    value: "cv", 
    label: "CV / Resume", 
    description: "Optimized for resume analysis and improvements", 
    tooltip: "Analyzes your resume for effectiveness, highlights skills gaps, and provides optimization recommendations."
  },
  { 
    value: "spreadsheet", 
    label: "Data / Spreadsheet", 
    description: "Analyze tabular data and metrics within PDFs", 
    tooltip: "Extracts and analyzes tables, charts, and numerical data from PDFs, even if they were originally spreadsheets."
  },
  { 
    value: "presentation", 
    label: "Presentation", 
    description: "Analyze slides and presentations in PDF format", 
    tooltip: "Evaluates presentation structure, messaging clarity, and visual hierarchy of slides saved as PDFs."
  },
  { 
    value: "scientific", 
    label: "Scientific Paper", 
    description: "Analyze research papers and academic articles", 
    tooltip: "Evaluates research quality, methodology, citations, and content structure of scientific papers and academic articles."
  }
];

// Document purpose selector component with tooltips
const DocumentPurposeSelector = ({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="relative mt-4">
      <div className="flex items-center">
        <label className="block text-[#F9F6EE] font-borna mb-2">Document Purpose</label>
        <div className="relative ml-2 group">
          <span className="cursor-help text-[#8A8782] hover:text-[#B4916C]">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </span>
          <div className="hidden group-hover:block absolute z-10 top-full left-0 w-64 p-3 bg-[#18161a] border border-[#333333] rounded-md shadow-lg text-[#C5C2BA] text-xs mt-2">
            Choose the purpose that best matches how you want to analyze your PDF, regardless of its original format.
          </div>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 md:py-2 bg-[#111111] border border-[#222222] rounded-md text-[#F9F6EE] font-borna appearance-none focus:outline-none focus:ring-2 focus:ring-[#B4916C] focus:border-transparent max-sm:text-base"
      >
        {documentPurposes.map((purpose) => (
          <option key={purpose.value} value={purpose.value} className="py-2">
            {purpose.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none mt-8">
        <svg className="w-5 h-5 text-[#B4916C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div className="flex items-center mt-1">
        <p className="text-[#8A8782] text-sm mr-2">
          {documentPurposes.find(p => p.value === value)?.description}
        </p>
        <div className="relative group">
          <span className="cursor-help text-[#8A8782] hover:text-[#B4916C]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </span>
          <div className="hidden group-hover:block absolute z-10 top-full left-0 w-64 p-3 bg-[#18161a] border border-[#333333] rounded-md shadow-lg text-[#C5C2BA] text-xs mt-2">
            {documentPurposes.find(p => p.value === value)?.tooltip}
          </div>
        </div>
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
  <div className="flex items-center justify-center flex-col py-12">
    <div className="w-12 h-12 border-4 border-[#222222] border-t-[#B4916C] rounded-full animate-spin mb-4"></div>
    <p className="text-[#C5C2BA] font-borna">{text}</p>
  </div>
);

// Empty state component
const EmptyDocumentState = () => (
  <div className="border border-[#222222] bg-[#111111] rounded-md p-8 text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#171717] text-[#B4916C] mb-4">
      <FileTextOutlined style={{ fontSize: "24px" }} />
    </div>
    <h3 className="text-xl font-safiro text-[#F9F6EE] mb-2">Select a document to analyze</h3>
    <p className="text-[#C5C2BA] font-borna max-w-md mx-auto">
      Our AI will analyze your document and extract insights, key information, and sentiment analysis.
    </p>
  </div>
);

// Feedback component for document analysis
const AnalysisFeedback = ({ documentId, analysisType }: { documentId: string, analysisType: string }) => {
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/document/analyze/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          analysisType,
          rating,
          feedbackText: feedbackText.trim() || undefined
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      setSubmitted(true);
      setTimeout(() => {
        setRating(null);
        setFeedbackText("");
        setSubmitted(false);
      }, 5000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Skip rendering if no document ID
  if (!documentId) return null;
  
  return (
    <div className="mt-6 border border-[#222222] rounded-md p-4 bg-[#111111]">
      <h4 className="text-[#F9F6EE] font-semibold mb-3">Was this analysis helpful?</h4>
      
      {submitted ? (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-[#B4916C]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Thank you for your feedback!</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setRating(value)}
                className={`w-8 h-8 flex items-center justify-center rounded-full ${
                  rating === value ? 'bg-[#B4916C] text-[#111111]' : 'bg-[#222222] text-[#F9F6EE] hover:bg-[#333333]'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          
          <textarea
            placeholder="Optional: Add any suggestions for improving the analysis..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="w-full p-3 bg-[#171717] border border-[#222222] rounded-md text-[#F9F6EE] placeholder-[#555555] focus:outline-none focus:ring-1 focus:ring-[#B4916C] focus:border-transparent resize-none h-24"
          />
          
          <div className="mt-3">
            <button
              onClick={handleSubmit}
              disabled={!rating || submitting}
              className="px-4 py-2 bg-[#333333] text-[#F9F6EE] rounded-md hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Feedback</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

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

// Add this new component to showcase the system enhancements
const EnhancementsHighlight = () => {
  return (
    <div className="mb-6 bg-gradient-to-r from-[#151515] to-[#111111] border border-[#222222] rounded-lg overflow-hidden">
      <div className="p-4 bg-[#B4916C]/10 border-b border-[#B4916C]/20">
        <h3 className="text-lg font-safiro text-[#F9F6EE] flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#B4916C]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Enhanced Document Analysis System
        </h3>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#171717] p-4 rounded-md">
          <div className="flex items-center mb-2">
            <div className="bg-[#B4916C] rounded-full p-1 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-[#F9F6EE] font-medium">Multi-Format Support</h4>
          </div>
          <p className="text-[#C5C2BA] text-sm">
            Now supporting PDF, DOCX, TXT, and more document formats with specialized analysis for each type.
          </p>
        </div>
        
        <div className="bg-[#171717] p-4 rounded-md">
          <div className="flex items-center mb-2">
            <div className="bg-[#B4916C] rounded-full p-1 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-[#F9F6EE] font-medium">Enhanced CV Analysis</h4>
          </div>
          <p className="text-[#C5C2BA] text-sm">
            Improved ATS compatibility scoring, industry keyword detection, and skill gap analysis.
          </p>
        </div>
        
        <div className="bg-[#171717] p-4 rounded-md">
          <div className="flex items-center mb-2">
            <div className="bg-[#B4916C] rounded-full p-1 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-[#F9F6EE] font-medium">AI-Powered Insights</h4>
          </div>
          <p className="text-[#C5C2BA] text-sm">
            Advanced AI models provide deeper insights and personalized improvement recommendations.
          </p>
        </div>
      </div>
      
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#171717] p-4 rounded-md">
          <div className="flex items-center mb-2">
            <div className="bg-[#B4916C] rounded-full p-1 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-[#F9F6EE] font-medium">Quality Feedback System</h4>
          </div>
          <p className="text-[#C5C2BA] text-sm">
            New feedback system allows you to rate analyses and provide suggestions for continuous improvement.
          </p>
        </div>
        
        <div className="bg-[#171717] p-4 rounded-md">
          <div className="flex items-center mb-2">
            <div className="bg-[#B4916C] rounded-full p-1 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#111111]" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
            </div>
            <h4 className="text-[#F9F6EE] font-medium">Advanced Analytics</h4>
          </div>
          <p className="text-[#C5C2BA] text-sm">
            View quality metrics and performance analytics for document analyses in the new analytics dashboard.
          </p>
          <div className="mt-2">
            <a
              href="/dashboard/analysis-quality"
              className="inline-flex items-center text-sm text-[#B4916C] hover:text-[#C5A17C] transition-colors"
            >
              View Analytics Dashboard
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DocumentAnalyzer({ documents }: DocumentAnalyzerProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentPurpose, setDocumentPurpose] = useState<string>("general");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("1");
  
  // Get the selected document's file name
  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);
  
  // Analysis type is primarily determined by document purpose
  const analysisType = documentPurpose;

  // Function to fetch document content by ID
  const fetchDocumentContent = async (documentId: string) => {
    try {
      console.log(`Fetching document content for ID: ${documentId}`);
      
      const response = await fetch(`/api/cv/get-details?cvId=${documentId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to fetch document content';
        console.error(`Error fetching document content: ${errorMessage}, status: ${response.status}`);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Check if we actually have text content
      if (!data.rawText) {
        console.warn(`Document ID ${documentId} has no text content`);
        throw new Error('Document has no text content for analysis');
      }
      
      console.log(`Successfully retrieved document content, length: ${data.rawText.length} characters`);
      return data.rawText;
    } catch (error) {
      console.error('Error fetching document content:', error);
      throw error;
    }
  };
  
  const handleAnalyze = async () => {
    if (!selectedDocumentId) {
      setError("Please select a document to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // First, fetch the document content
      let documentText = '';
      try {
        documentText = await fetchDocumentContent(selectedDocumentId);
        
        if (!documentText) {
          setError("The document has no text content for analysis. Try re-uploading the document.");
          setIsAnalyzing(false);
          return;
        }
      } catch (fetchError) {
        console.error("Error fetching document content:", fetchError);
        if (fetchError instanceof Error && fetchError.message.includes('no text content')) {
          setError("This document doesn't have any text content that can be analyzed. Please upload a document that contains text.");
        } else {
          setError("Could not retrieve document content. Please try again.");
        }
        setIsAnalyzing(false);
        return;
      }

      console.log(`Sending document for analysis, text length: ${documentText.length} characters, purpose: ${documentPurpose}`);
      
      // Now send for analysis with the document content
      const response = await fetch(`/api/document/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          documentId: selectedDocumentId,
          documentText: documentText,
          fileName: selectedDocument?.fileName,
          documentPurpose: documentPurpose // Add the document purpose to the API request
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Analysis API error: ${errorData}, status: ${response.status}`);
        throw new Error(errorData || "Failed to analyze document");
      }

      const data = await response.json();
      console.log(`Analysis completed successfully`, data);
      setAnalysisResult(data.analysis || data);
    } catch (err) {
      console.error("Analysis error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred while analyzing the document";
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedDocumentId) {
      setError("Please select a document to export");
      return;
    }
    
    if (!analysisResult) {
      setError("Please analyze the document first before exporting the PDF");
      return;
    }
    
    setIsPdfExporting(true);
    setError(null);
    
    try {
      // Open the PDF download endpoint in a new tab
      window.open(`/api/reports/analysis?documentId=${selectedDocumentId}`, '_blank');
      
      // Show success message
      // Note: We don't wait for the download to complete since it opens in a new tab
      setTimeout(() => {
        setIsPdfExporting(false);
      }, 1000);
    } catch (err) {
      console.error("PDF export error:", err);
      setError("An error occurred while exporting the PDF");
      setIsPdfExporting(false);
    }
  };
  
  const handleShare = async () => {
    if (!selectedDocumentId) {
      setError("Please select a document to share");
      return;
    }
    
    // Generate share URL
    const shareUrl = `${window.location.origin}/share/analysis/${selectedDocumentId}`;
    
    // Try to use the Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Document Analysis: ${selectedDocument?.fileName}`,
          text: "Check out this document analysis",
          url: shareUrl
        });
        return;
      } catch (err) {
        console.log("Share API error, falling back to clipboard", err);
      }
    }
    
    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Share link copied to clipboard!");
    } catch (err) {
      console.error("Clipboard error:", err);
      alert("Share URL: " + shareUrl);
    }
  };
  
  // Get the file type icon
  const getFileTypeIcon = () => {
    if (!selectedDocument || !selectedDocument.fileName) return <FileTextOutlined />;
    
    const fileType = detectFileType(selectedDocument.fileName);
    if (!fileType) return <FileTextOutlined />;
    
    switch (fileType.category) {
      case 'spreadsheet':
        return <FileExcelOutlined style={{ color: '#217346' }} />;
      case 'presentation':
        return <FilePptOutlined style={{ color: '#D24726' }} />;
      case 'document':
      default:
        return <FileTextOutlined style={{ color: '#2B579A' }} />;
    }
  };
  
  // Function to determine which analysis section to render based on tab
  const renderAnalysisSection = (section: string) => {
    if (!analysisResult) {
      return <Empty description="No analysis data available" />;
    }
    
    switch (section) {
      case "summary":
        return renderSummary();
      case "content":
        // Use document purpose to determine which content analysis to show
        switch (documentPurpose) {
          case 'spreadsheet':
            return renderSpreadsheetAnalysis();
          case 'presentation':
            return renderPresentationAnalysis();
          case 'cv':
            return renderCVAnalysis();
          case 'scientific':
            return renderScientificAnalysis();
          default:
            return renderContentAnalysis();
        }
      case "sentiment":
        return renderSentimentAnalysis();
      case "keyinfo":
        return renderKeyInformation();
      default:
        return <Empty description="Unknown analysis section" />;
    }
  };
  
  // Helper function to render spreadsheet data analysis
  const renderSpreadsheetAnalysis = () => {
    if (!analysisResult) return null;
    
    // Access data analysis properties with safe defaults
    const dataStructureAnalysis = analysisResult.dataStructureAnalysis || {};
    const dataInsights = analysisResult.dataInsights || {};
    const dataQualityAssessment = analysisResult.dataQualityAssessment || {};
    
    return (
      <div className="space-y-6">
        <Card title="Data Structure Analysis">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Tables</div>
              <div className="text-2xl font-safiro text-[#F9F6EE]">{dataStructureAnalysis.tableCount || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Columns</div>
              <div className="text-2xl font-safiro text-[#F9F6EE]">{dataStructureAnalysis.columnCount || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Rows</div>
              <div className="text-2xl font-safiro text-[#F9F6EE]">{dataStructureAnalysis.rowCount || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Completeness</div>
              <Progress 
                type="circle" 
                percent={dataStructureAnalysis.completeness || 0} 
                width={60} 
                strokeColor="#B4916C"
              />
            </div>
          </div>
          <div>
            <div className="text-[#C5C2BA] mb-2">Data Types</div>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(dataStructureAnalysis.dataTypes) ? 
                dataStructureAnalysis.dataTypes.map((type: string, index: number) => (
                  <span key={index} className="px-2 py-1 bg-[#222222] text-[#F9F6EE] rounded text-sm">
                    {type}
                  </span>
                )) : 
                <span className="text-[#C5C2BA]">No data types detected</span>
              }
            </div>
          </div>
        </Card>
        
        <Card title="Data Quality Assessment">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Completeness</div>
              <Progress 
                percent={dataQualityAssessment.completenessScore || 0} 
                strokeColor="#B4916C" 
              />
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Consistency</div>
              <Progress 
                percent={dataQualityAssessment.consistencyScore || 0} 
                strokeColor="#B4916C" 
              />
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Accuracy</div>
              <Progress 
                percent={dataQualityAssessment.accuracyScore || 0} 
                strokeColor="#B4916C" 
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-[#C5C2BA] mb-2">Overall Data Quality</div>
            <Progress 
              percent={dataQualityAssessment.overallDataQualityScore || 0} 
              strokeColor="#B4916C" 
              status={(dataQualityAssessment.overallDataQualityScore || 0) >= 80 ? "success" : "normal"}
            />
          </div>
        </Card>
        
        {/* Data Insights */}
        <Card title="Data Insights">
          <Collapse defaultActiveKey={['1']} bordered={false} className="bg-transparent">
            <Panel header="Trends & Patterns" key="1" className="bg-[#0A0A0A] border border-[#222222] mb-2">
              <ul className="list-disc pl-5 text-[#C5C2BA]">
                {Array.isArray(dataInsights.trends) ? 
                  dataInsights.trends.map((trend: any, index: number) => (
                    <li key={index} className="mb-2">
                      {trend.description}
                      <span className="text-[#B4916C] ml-2 text-sm">
                        {trend.significance && `(${trend.significance})`}
                      </span>
                    </li>
                  )) : 
                  <li>No trends detected</li>
                }
              </ul>
            </Panel>
            <Panel header="Anomalies & Outliers" key="2" className="bg-[#0A0A0A] border border-[#222222]">
              <ul className="list-disc pl-5 text-[#C5C2BA]">
                {Array.isArray(dataInsights.outliers) ? 
                  dataInsights.outliers.map((outlier: any, index: number) => (
                    <li key={index} className="mb-2">
                      {outlier.description}
                      <div className="text-[#8A8782] text-sm mt-1 ml-2">
                        {outlier.impact && `Impact: ${outlier.impact}`}
                      </div>
                    </li>
                  )) : 
                  <li>No anomalies detected</li>
                }
              </ul>
            </Panel>
          </Collapse>
        </Card>
      </div>
    );
  };

  // Helper function to render presentation analysis
  const renderPresentationAnalysis = () => {
    if (!analysisResult) return null;
    
    // Access presentation analysis properties with safe defaults
    const presentationStructure = analysisResult.presentationStructure || {};
    const messageClarity = analysisResult.messageClarity || {};
    const contentBalance = analysisResult.contentBalance || {};
    const designAssessment = analysisResult.designAssessment || {};
    
    return (
      <div className="space-y-6">
        <Card title="Presentation Structure Analysis">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Estimated Slides</div>
              <div className="text-2xl font-safiro text-[#F9F6EE]">
                {presentationStructure.estimatedSlideCount || '?'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Introduction</div>
              <div className="text-2xl font-safiro text-[#F9F6EE]">
                {presentationStructure.hasIntroduction ? '✓' : '✗'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Conclusion</div>
              <div className="text-2xl font-safiro text-[#F9F6EE]">
                {presentationStructure.hasConclusion ? '✓' : '✗'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[#C5C2BA] mb-2">Narrative Flow</div>
              <Progress 
                type="circle" 
                percent={presentationStructure.narrativeFlow || 0} 
                width={60} 
                strokeColor="#B4916C"
              />
            </div>
          </div>
        </Card>
        
        <Card title="Message Clarity">
          <div className="mb-4">
            <div className="text-[#C5C2BA] mb-2">Main Message</div>
            <div className="p-3 bg-[#0A0A0A] border border-[#222222] rounded text-[#F9F6EE]">
              {messageClarity.mainMessage || 'No clear main message detected'}
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-[#C5C2BA] mb-2">Message Clarity Score</div>
            <Progress 
              percent={messageClarity.clarity || 0} 
              strokeColor="#B4916C" 
            />
          </div>
          
          <div>
            <div className="text-[#C5C2BA] mb-2">Supporting Points</div>
            <ul className="list-disc pl-5 text-[#C5C2BA]">
              {Array.isArray(messageClarity.supportingPoints) ? 
                messageClarity.supportingPoints.map((point: any, index: number) => (
                  <li key={index} className="mb-2">
                    {point.point}
                    <div className="ml-2 mt-1">
                      <Progress 
                        percent={point.clarity || 0} 
                        size="small" 
                        strokeColor="#B4916C" 
                      />
                    </div>
                  </li>
                )) : 
                <li>No supporting points detected</li>
              }
            </ul>
          </div>
        </Card>
        
        <Card title="Design Assessment">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[#C5C2BA] mb-2 text-center">Visual Consistency</div>
              <Progress 
                type="circle" 
                percent={designAssessment.consistencyScore || 0} 
                width={80} 
                strokeColor="#B4916C"
              />
            </div>
            <div>
              <div className="text-[#C5C2BA] mb-2 text-center">Readability</div>
              <Progress 
                type="circle" 
                percent={designAssessment.readabilityScore || 0} 
                width={80} 
                strokeColor="#B4916C"
              />
            </div>
            <div>
              <div className="text-[#C5C2BA] mb-2 text-center">Visual Hierarchy</div>
              <Progress 
                type="circle" 
                percent={designAssessment.visualHierarchyScore || 0} 
                width={80} 
                strokeColor="#B4916C"
              />
            </div>
          </div>
        </Card>
      </div>
    );
  };
  
  // Render content analysis based on file type
  const renderContentAnalysis = () => {
    if (!analysisResult) {
      return <Empty description="No content analysis available" />;
    }
    
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card title="Document Quality Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart 
              outerRadius={90} 
              width={500} 
              height={300} 
              data={
                analysisResult.insights ? 
                Object.entries(analysisResult.insights)
                  .filter(([key]) => key !== 'overallScore')
                  .map(([key, value]) => ({
                    subject: key.replace(/([A-Z])/g, ' $1').trim(),
                    score: value as number,
                    fullMark: 100
                  })) : 
                []
              }
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar 
                name="Document Quality" 
                dataKey="score" 
                stroke="#B4916C" 
                fill="#B4916C" 
                fillOpacity={0.6}
              />
              <RechartsTooltip formatter={(value: number) => `${value}/100`} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Key Points">
          <List
            dataSource={analysisResult.keyPoints || []}
            renderItem={(item: string, index: number) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: index % 2 === 0 ? "#B4916C" : "#333333" }}>{index + 1}</Avatar>}
                  title={<span className="text-[#F9F6EE]">{item}</span>}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    );
  };
  
  // Render sentiment analysis based on file type
  const renderSentimentAnalysis = () => {
    if (!analysisResult?.sentiment) {
      return <Empty description="No sentiment analysis available" />;
    }
    
    return (
      <div className="grid grid-cols-1 gap-4">
        <Card title="Document Sentiment">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="text-xl font-bold mb-2 capitalize text-[#F9F6EE]">
              {analysisResult.sentiment.overall}
            </div>
            <Progress 
              percent={Math.round(analysisResult.sentiment.score * 100)} 
              status={
                analysisResult.sentiment.overall === "positive" ? "success" : 
                analysisResult.sentiment.overall === "negative" ? "exception" : 
                "normal"
              }
              strokeColor={
                analysisResult.sentiment.overall === "positive" ? "#52c41a" :
                analysisResult.sentiment.overall === "negative" ? "#ff4d4f" :
                "#B4916C"
              }
            />
            <div className="mt-2 text-sm text-[#F9F6EE]">
              Sentiment Score: {Math.round(analysisResult.sentiment.score * 100)}%
            </div>
          </div>
        </Card>
        
        <Card title="Language Quality">
          {analysisResult.languageQuality && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(analysisResult.languageQuality).map(([key, value]: [string, any]) => (
                <div key={key} className="text-center">
                  <div className="mb-2 text-sm text-[#F9F6EE] capitalize">{key}</div>
                  <Progress
                    type="circle"
                    percent={value}
                    width={80}
                    strokeColor={
                      value >= 80 ? "#52c41a" : 
                      value >= 60 ? "#B4916C" : 
                      "#ff4d4f"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  };
  
  // Render key information based on file type
  const renderKeyInformation = () => {
    if (!analysisResult) {
      return <Empty description="No key information available" />;
    }
    
    // For CV/resume files, render CV-specific information
    if (selectedDocument && selectedDocument.fileName && selectedDocument.fileName.toLowerCase().includes('cv')) {
      return (
        <div className="grid grid-cols-1 gap-4">
          <Card title="Document Type" className="text-center">
            <div className="text-2xl font-bold mb-3 text-[#F9F6EE]">
              {selectedDocument.fileName.toLowerCase().includes('cv') ? 'CV / Resume' : 'Document'}
            </div>
            <div className="text-[#C5C2BA]">
              {`File type: ${selectedDocument.fileName ? (detectFileType(selectedDocument.fileName)?.name || 'Unknown').toUpperCase() : 'Unknown'} • Created: ${new Date(selectedDocument.createdAt || Date.now()).toLocaleDateString()}`}
            </div>
          </Card>
          
          <Card title="Recommendations">
            <List
              dataSource={analysisResult.recommendations || []}
              renderItem={(item: string, index: number) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        style={{ backgroundColor: '#52c41a' }}
                        icon={<CheckOutlined />}
                      />
                    }
                    title={<span>{item}</span>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>
      );
    }
    
    // Generic document information
    return (
      <div className="grid grid-cols-1 gap-4">
        <Card title="Document Information">
          <table className="min-w-full">
            <tbody>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider w-1/3">File Name</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">{selectedDocument?.fileName}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">File Type</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">
                  {selectedDocument && selectedDocument.fileName 
                    ? (detectFileType(selectedDocument.fileName)?.name || 'Unknown').toUpperCase() 
                    : 'UNKNOWN'}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">Created</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">{new Date(selectedDocument?.createdAt || Date.now()).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">Analysis Type</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE] capitalize">{analysisType}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Quality</td>
                <td className="px-6 py-3 text-left text-sm text-gray-900">
                  <Progress 
                    percent={analysisResult.insights?.overallScore || 0} 
                    size="small" 
                    status={(analysisResult.insights?.overallScore || 0) >= 70 ? "success" : (analysisResult.insights?.overallScore || 0) >= 40 ? "normal" : "exception"} 
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        
        <Card title="Key Points">
          <List
            dataSource={analysisResult.keyPoints || []}
            renderItem={(item: string, index: number) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: index % 2 === 0 ? "#B4916C" : "#333333" }}>{index + 1}</Avatar>}
                  title={<span className="text-[#F9F6EE]">{item}</span>}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    );
  };
  
  // Render summary based on file type
  const renderSummary = () => {
    if (!analysisResult) {
      return <Empty description="No summary available" />;
    }
    
    // The summary section is similar for all file types
    return (
      <div>
        <Card title="Document Analysis Summary" className="mb-4">
          <div className="py-3 px-4 bg-[#171717] rounded-md mb-4">
            <p className="text-[#F9F6EE]">{analysisResult.summary}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold mb-3 text-[#F9F6EE]">Key Points</h3>
              <ul className="list-disc pl-5">
                {analysisResult.keyPoints?.map((point: string, index: number) => (
                  <li key={`point-${index}`} className="mb-2 text-[#F9F6EE]">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-3 text-[#F9F6EE]">Recommendations</h3>
              <ul className="list-disc pl-5">
                {analysisResult.recommendations?.map((recommendation: string, index: number) => (
                  <li key={`recommendation-${index}`} className="mb-2 text-[#F9F6EE]">
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        
        <Card title="Document Quality Insights">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {analysisResult.insights && Object.entries(analysisResult.insights).map(([key, value]: [string, any], index) => {
              // Skip overallScore as we'll display it prominently
              if (key === 'overallScore') return null;
              
              return (
                <div key={key} className="bg-[#171717] p-3 rounded-md text-center">
                  <div className="text-sm text-[#F9F6EE] capitalize mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-lg font-semibold">
                    <Progress percent={value} size="small" showInfo={false} strokeColor="#B4916C" />
                    <span className="mt-1 inline-block text-[#F9F6EE]">{value}/100</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-center mb-4">
            <Progress
              type="circle"
              percent={analysisResult.insights?.overallScore || 0}
              format={(percent) => `${percent}`}
              strokeColor={{
                '0%': '#333333',
                '100%': '#B4916C',
              }}
              width={120}
            />
          </div>
          
          <p className="text-center text-[#F9F6EE]">
            {(analysisResult.insights?.overallScore || 0) >= 80 
              ? "Excellent quality! Your document is well-structured and effective." 
              : (analysisResult.insights?.overallScore || 0) >= 60 
                ? "Good quality with some room for improvement." 
                : "This document could use improvement in several areas."}
          </p>
        </Card>
      </div>
    );
  };
  
  // Helper function to render CV analysis
  const renderCVAnalysis = () => {
    if (!analysisResult) return null;
    
    // Extract CV-specific analysis data
    const insights = analysisResult.insights || {};
    const cvAnalysis = analysisResult.cvAnalysis || {};
    const experienceAnalysis = analysisResult.experienceAnalysis || {};
    const skillsAnalysis = analysisResult.skillsAnalysis || {};
    const industryInsights = analysisResult.industryInsights || {};
    const atsAnalysis = analysisResult.atsAnalysis || {};
    
    return (
      <div className="space-y-6">
        {/* CV Quality Overview Card */}
        <Card title="CV Quality Analysis" className="border border-[#222222] bg-[#111111]">
          <div className="mb-6">
            <div className="flex justify-center">
              <Progress
                type="circle"
                percent={insights.overallScore || 0}
                format={(percent) => `${percent}`}
                strokeColor={{
                  '0%': '#333333',
                  '100%': '#B4916C',
                }}
                width={120}
              />
            </div>
            <p className="text-center mt-4 text-[#F9F6EE] font-borna">
              {(insights.overallScore || 0) >= 80 
                ? "Excellent CV! Your document is well-structured and effective."
                : (insights.overallScore || 0) >= 60 
                  ? "Good CV with some room for improvement."
                  : "This CV could benefit from significant improvements."}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-[#171717] rounded-lg">
              <div className="text-[#C5C2BA] text-sm mb-1">ATS Compatibility</div>
              <Progress 
                percent={insights.atsCompatibility || atsAnalysis.atsCompatibilityScore || 0} 
                strokeColor="#B4916C" 
                size="small"
              />
            </div>
            <div className="text-center p-3 bg-[#171717] rounded-lg">
              <div className="text-[#C5C2BA] text-sm mb-1">Industry Alignment</div>
              <Progress 
                percent={industryInsights.industryAlignment || 0} 
                strokeColor="#B4916C" 
                size="small"
              />
            </div>
            <div className="text-center p-3 bg-[#171717] rounded-lg">
              <div className="text-[#C5C2BA] text-sm mb-1">Achievement Focus</div>
              <Progress 
                percent={experienceAnalysis.achievementsToResponsibilitiesRatio || 0} 
                strokeColor="#B4916C" 
                size="small"
              />
            </div>
          </div>
        </Card>
        
        {/* Industry Insights Card */}
        <Card 
          title={
            <div className="flex items-center">
              <span className="text-[#F9F6EE] mr-2">Industry Analysis</span>
              <span className="bg-[#333333] text-[#B4916C] px-2 py-0.5 rounded text-sm">
                {industryInsights.identifiedIndustry || "General"}
              </span>
            </div>
          } 
          className="border border-[#222222] bg-[#111111]"
        >
          <div className="space-y-4">
            {/* Industry Keywords */}
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-2">Industry Keywords Found</h4>
              {renderKeywordChips(industryInsights.industryKeywords || [])}
            </div>
            
            {/* Missing Industry Keywords */}
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-2">Missing Industry Keywords</h4>
              {renderMissingKeywords(industryInsights.missingIndustryKeywords || [])}
            </div>
            
            {/* Industry Trends */}
            {industryInsights.recruitmentTrends && (
              <div>
                <h4 className="text-[#F9F6EE] font-semibold mb-2">Recruitment Trends</h4>
                <p className="text-[#C5C2BA]">{industryInsights.recruitmentTrends}</p>
              </div>
            )}
          </div>
        </Card>
        
        {/* Experience Analysis Card */}
        <Card title="Experience Analysis" className="border border-[#222222] bg-[#111111]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-3">Experience Overview</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[#C5C2BA] text-sm mb-1">
                    <span>Relevant Experience</span>
                    <span>{experienceAnalysis.experienceRelevance || 0}/100</span>
                  </div>
                  <Progress 
                    percent={experienceAnalysis.experienceRelevance || 0} 
                    strokeColor="#B4916C" 
                    size="small"
                    showInfo={false}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[#C5C2BA] text-sm mb-1">
                    <span>Action Verbs</span>
                    <span>{experienceAnalysis.actionVerbUsage || 0}/100</span>
                  </div>
                  <Progress 
                    percent={experienceAnalysis.actionVerbUsage || 0} 
                    strokeColor="#B4916C" 
                    size="small"
                    showInfo={false}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[#C5C2BA] text-sm mb-1">
                    <span>Quantified Results</span>
                    <span>{experienceAnalysis.quantifiedResults || 0}/100</span>
                  </div>
                  <Progress 
                    percent={experienceAnalysis.quantifiedResults || 0} 
                    strokeColor="#B4916C" 
                    size="small"
                    showInfo={false}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-3">Job History</h4>
              {experienceAnalysis.experienceInYears && (
                <div className="mb-2 text-[#F9F6EE]">
                  <span className="font-bold text-[#B4916C]">{experienceAnalysis.experienceInYears}</span> years of experience
                </div>
              )}
              <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333333] scrollbar-track-[#111111]">
                {(experienceAnalysis.jobTitles || []).map((title: string, index: number) => {
                  const company = experienceAnalysis.companies?.[index] || '';
                  return (
                    <div key={index} className="mb-2 pb-2 border-b border-[#222222] last:border-0">
                      <div className="text-[#F9F6EE]">{title}</div>
                      {company && <div className="text-[#8A8782] text-sm">{company}</div>}
                    </div>
                  );
                })}
                {(!experienceAnalysis.jobTitles || experienceAnalysis.jobTitles.length === 0) && (
                  <div className="text-[#8A8782]">No job history detected</div>
                )}
              </div>
            </div>
          </div>
        </Card>
        
        {/* ATS Analysis Card */}
        <Card title="ATS Optimization" className="border border-[#222222] bg-[#111111]">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#F9F6EE] font-semibold">ATS Compatibility Score</span>
              <span className="text-[#F9F6EE]">{atsAnalysis.atsCompatibilityScore || 0}/100</span>
            </div>
            <Progress 
              percent={atsAnalysis.atsCompatibilityScore || 0} 
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#faad14',
                '100%': '#52c41a',
              }}
            />
          </div>
          
          <div className="space-y-4">
            {/* ATS Issues */}
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-2">Formatting Issues</h4>
              {renderIssueItems(atsAnalysis.formatIssues || [])}
            </div>
            
            {/* Improvement Suggestions */}
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-2">ATS Improvement Suggestions</h4>
              {renderSuggestionItems(atsAnalysis.improvementSuggestions || [])}
            </div>
          </div>
        </Card>
        
        {/* Skills Analysis Card */}
        <Card title="Skills Analysis" className="border border-[#222222] bg-[#111111]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-3">Technical Skills</h4>
              {renderSkillTitles(skillsAnalysis.technicalSkills || [])}
            </div>
            
            <div>
              <h4 className="text-[#F9F6EE] font-semibold mb-3">Soft Skills</h4>
              {renderSkillTitles(skillsAnalysis.softSkills || [])}
            </div>
          </div>
          
          <div className="mt-4">
            <h4 className="text-[#F9F6EE] font-semibold mb-2">Skill Gaps</h4>
            {renderMissingKeywords(skillsAnalysis.skillsGaps || [])}
          </div>
        </Card>
        
        {/* Recommendations Card */}
        <Card 
          title="Improvement Recommendations" 
          className="border border-[#222222] bg-[#111111]"
        >
          <div className="space-y-3">
            {(analysisResult.recommendations || []).map((recommendation: string, index: number) => (
              <div 
                key={index} 
                className="p-3 bg-[#171717] rounded-lg border-l-4 border-[#B4916C]"
              >
                <p className="text-[#F9F6EE]">{recommendation}</p>
              </div>
            ))}
            {(!analysisResult.recommendations || analysisResult.recommendations.length === 0) && (
              <p className="text-[#8A8782]">No recommendations available</p>
            )}
          </div>
        </Card>
      </div>
    );
  };
  
  // Helper function to render scientific analysis
  const renderScientificAnalysis = () => {
    if (!analysisResult) {
      return <Empty description="No scientific analysis available" />;
    }
    
    // Access the scientific paper specific data with fallbacks
    const researchQuality = analysisResult.researchQuality || {
      overall: "neutral",
      score: 0.5
    };
    
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card title="Research Quality">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="text-xl font-bold mb-2 capitalize text-[#F9F6EE]">
              {researchQuality.overall}
            </div>
            <Progress 
              percent={Math.round((researchQuality.score || 0) * 100)} 
              status={
                researchQuality.overall === "positive" ? "success" : 
                researchQuality.overall === "negative" ? "exception" : 
                "normal"
              }
              strokeColor={
                researchQuality.overall === "positive" ? "#52c41a" :
                researchQuality.overall === "negative" ? "#ff4d4f" :
                "#B4916C"
              }
            />
            <div className="mt-2 text-sm text-[#F9F6EE]">
              Research Score: {Math.round((researchQuality.score || 0) * 100)}%
            </div>
          </div>
        </Card>
        
        <Card title="Key Points">
          <List
            dataSource={analysisResult.keyPoints || []}
            renderItem={(item: string, index: number) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: index % 2 === 0 ? "#B4916C" : "#333333" }}>{index + 1}</Avatar>}
                  title={<span className="text-[#F9F6EE]">{item}</span>}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    );
  };
  
  return (
    <div className="w-full">
      <div className="space-y-4">
        <EnhancementsHighlight />
        
        <div className="mb-4">
          <label className="block mb-2 text-[#F9F6EE] font-borna">Select Document</label>
          <DocSelector
            documents={documents}
            value={selectedDocumentId}
            onChange={setSelectedDocumentId}
          />
        </div>
        
        {selectedDocument && (
          <DocumentPurposeSelector
            value={documentPurpose}
            onChange={setDocumentPurpose}
          />
        )}
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedDocumentId}
            className="px-4 py-2 bg-[#333333] text-[#F9F6EE] font-borna rounded-md hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                <span>Analyze Document</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={!analysisResult || isPdfExporting}
            className="px-4 py-2 bg-[#222222] text-[#F9F6EE] font-borna rounded-md hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isPdfExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent border-[#B4916C] rounded-full animate-spin"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <DownloadOutlined />
                <span>Export PDF</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleShare}
            disabled={!analysisResult}
            className="px-4 py-2 bg-[#222222] text-[#F9F6EE] font-borna rounded-md hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <ShareAltOutlined />
            <span>Share</span>
          </button>
        </div>
        
        {error && (
          <div className="mt-4 px-4 py-3 bg-[#3A1F24] border border-[#E57373]/30 text-[#F9F6EE] font-borna rounded-md">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-[#E57373] mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">{error}</p>
                {error.includes("document content") && (
                  <p className="mt-1 text-sm opacity-80">
                    This could happen if the document wasn't properly processed. Try uploading the document again or contact support.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {isAnalyzing ? (
          <LoadingSpinner text="Analyzing your document. This may take a minute..." />
        ) : analysisResult ? (
          <div className="mt-8 border border-[#222222] bg-[#111111] rounded-md p-4">
            <div className="flex items-center mb-4">
              {getFileTypeIcon()}
              <h3 className="ml-2 text-lg text-[#F9F6EE] font-safiro">{selectedDocument?.fileName}</h3>
            </div>
            
            <div className="mb-6">
              <Tabs defaultActiveKey="1" activeKey={activeTab} onChange={setActiveTab} className="custom-tabs">
                <TabPane tab="Overview" key="1">
                  {renderAnalysisSection("summary")}
                </TabPane>
                <TabPane tab="Quality Insights" key="2">
                  {renderAnalysisSection("content")}
                </TabPane>
                <TabPane tab="Sentiment & Language" key="3">
                  {renderAnalysisSection("sentiment")}
                </TabPane>
                <TabPane tab={selectedDocument && selectedDocument.fileName && selectedDocument.fileName.toLowerCase().includes('cv') ? "CV Details" : "Document Details"} key="4">
                  {renderAnalysisSection("keyinfo")}
                </TabPane>
              </Tabs>
            </div>
            
            {/* Add the feedback component */}
            {selectedDocumentId && (
              <AnalysisFeedback 
                documentId={selectedDocumentId} 
                analysisType={analysisType}
              />
            )}
          </div>
        ) : (
          <EmptyDocumentState />
        )}
      </div>
    </div>
  );
}
  