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
  
  // Check if the selected document is a PDF
  const isSelectedDocumentPdf = selectedDocument ? isPdfFile(selectedDocument.fileName) : false;
  
  // Analysis type is now primarily determined by document purpose, not file type
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
    
    // Validate that the selected document is a PDF
    if (selectedDocument && !isSelectedDocumentPdf) {
      setError("Only PDF documents are supported for analysis. Please select a PDF document.");
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
    
    // For CV analysis, we'll reuse the existing key information section
    // but with some enhancements specific to CVs
    return (
      <div className="space-y-6">
        <Card title="CV Quality Analysis">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[#C5C2BA] mb-2">Document Type</div>
              <div className="text-lg font-safiro text-[#F9F6EE]">CV / Resume</div>
            </div>
            <div>
              <div className="text-[#C5C2BA] mb-2">Overall Quality</div>
              <Progress 
                percent={analysisResult.insights?.overallScore || 0} 
                strokeColor="#B4916C" 
              />
            </div>
          </div>
        </Card>
        
        <Card title="Content Breakdown">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[#F9F6EE] font-medium mb-3">Key Strengths</h4>
              <ul className="list-disc list-inside text-[#C5C2BA] space-y-2">
                {Array.isArray(analysisResult.keyPoints) ? 
                  analysisResult.keyPoints.slice(0, 3).map((point: string, index: number) => (
                    <li key={index}>{point}</li>
                  )) : 
                  <li>No key strengths identified</li>
                }
              </ul>
            </div>
            <div>
              <h4 className="text-[#F9F6EE] font-medium mb-3">Areas for Improvement</h4>
              <ul className="list-disc list-inside text-[#C5C2BA] space-y-2">
                {Array.isArray(analysisResult.recommendations) ? 
                  analysisResult.recommendations.map((rec: string, index: number) => (
                    <li key={index}>{rec}</li>
                  )) : 
                  <li>No recommendations available</li>
                }
              </ul>
            </div>
          </div>
        </Card>
        
        <Card title="CV Metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analysisResult.insights && Object.entries(analysisResult.insights).map(([key, value]: [string, any], index: number) => {
              // Skip the overall score as we already display it
              if (key === 'overallScore') return null;
              
              return (
                <div key={index} className="text-center">
                  <div className="text-[#C5C2BA] mb-2 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <Progress 
                    type="circle" 
                    percent={value || 0} 
                    width={70} 
                    strokeColor="#B4916C" 
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };
  
  // Helper function to render scientific paper analysis
  const renderScientificAnalysis = () => {
    if (!analysisResult) return <Empty description="No analysis data available" />;

    // Access the scientific paper specific data
    const {
      researchStructure,
      researchQuality,
      citationAnalysis,
      contentAssessment,
      researchGaps,
      futureWorkSuggestions
    } = analysisResult;

    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h3 className="text-xl text-[#F9F6EE] font-safiro mb-3">Research Paper Analysis</h3>
          <p className="text-[#C5C2BA] font-borna">
            Detailed analysis of the research paper's structure, methodology, and contribution to the field.
          </p>
        </div>

        {/* Research Structure */}
        <div className="space-y-4">
          <h4 className="text-lg text-[#F9F6EE] font-safiro border-b border-[#333333] pb-2">
            Research Structure
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Structure components */}
            <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
              <h5 className="text-[#B4916C] font-safiro mb-3">Structure Components</h5>
              <div className="space-y-2">
                {researchStructure && (
                  <ul className="grid grid-cols-1 gap-2">
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasAbstract ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">Abstract</span>
                    </li>
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasIntroduction ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">Introduction</span>
                    </li>
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasMethodology ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">Methodology</span>
                    </li>
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasResults ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">Results</span>
                    </li>
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasDiscussion ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">Discussion</span>
                    </li>
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasConclusion ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">Conclusion</span>
                    </li>
                    <li className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-2 ${researchStructure.hasReferences ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-[#F9F6EE] font-borna">References</span>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {/* Structure Quality */}
            <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
              <h5 className="text-[#B4916C] font-safiro mb-3">Structure Quality</h5>
              {researchStructure && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Completeness</span>
                      <span className="text-[#B4916C] font-borna">{researchStructure.structureCompleteness || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchStructure.structureCompleteness || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Quality</span>
                      <span className="text-[#B4916C] font-borna">{researchStructure.structureQuality || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchStructure.structureQuality || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Research Quality */}
        <div className="space-y-4">
          <h4 className="text-lg text-[#F9F6EE] font-safiro border-b border-[#333333] pb-2">
            Research Quality Assessment
          </h4>
          {researchQuality && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
                <h5 className="text-[#B4916C] font-safiro mb-3">Methodology & Analysis</h5>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Methodology Rigor</span>
                      <span className="text-[#B4916C] font-borna">{researchQuality.methodologyRigor || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchQuality.methodologyRigor || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Data Quality</span>
                      <span className="text-[#B4916C] font-borna">{researchQuality.dataQuality || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchQuality.dataQuality || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Analysis Depth</span>
                      <span className="text-[#B4916C] font-borna">{researchQuality.analysisDepth || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchQuality.analysisDepth || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
                <h5 className="text-[#B4916C] font-safiro mb-3">Contribution & Impact</h5>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Originality</span>
                      <span className="text-[#B4916C] font-borna">{researchQuality.originalityScore || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchQuality.originalityScore || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Impact Potential</span>
                      <span className="text-[#B4916C] font-borna">{researchQuality.impactPotential || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchQuality.impactPotential || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#F9F6EE] font-borna">Overall Quality</span>
                      <span className="text-[#B4916C] font-borna">{researchQuality.overallQuality || 0}%</span>
                    </div>
                    <div className="w-full bg-[#333333] rounded-full h-2.5">
                      <div 
                        className="bg-[#B4916C] h-2.5 rounded-full" 
                        style={{ width: `${researchQuality.overallQuality || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Citation Analysis */}
        {citationAnalysis && (
          <div className="space-y-4">
            <h4 className="text-lg text-[#F9F6EE] font-safiro border-b border-[#333333] pb-2">
              Citation Analysis
            </h4>
            <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col items-center p-3 bg-[#111111] rounded-lg">
                  <span className="text-[#B4916C] text-3xl font-safiro">{citationAnalysis.estimatedCitationCount || 0}</span>
                  <span className="text-[#C5C2BA] text-sm mt-1">Citations</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-[#111111] rounded-lg">
                  <span className="text-[#B4916C] text-3xl font-safiro">{citationAnalysis.recentReferences || 0}%</span>
                  <span className="text-[#C5C2BA] text-sm mt-1">Recent References</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-[#111111] rounded-lg">
                  <span className="text-[#B4916C] text-3xl font-safiro">{citationAnalysis.citationQuality || 0}%</span>
                  <span className="text-[#C5C2BA] text-sm mt-1">Citation Quality</span>
                </div>
              </div>

              {/* Key References */}
              {citationAnalysis.keyReferences && citationAnalysis.keyReferences.length > 0 && (
                <div>
                  <h5 className="text-[#B4916C] font-safiro mb-2">Key References</h5>
                  <ul className="space-y-1 text-[#F9F6EE] font-borna">
                    {citationAnalysis.keyReferences.map((reference: string, index: number) => (
                      <li key={index} className="text-sm">
                        • {reference}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Research Gaps and Future Work */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Research Gaps */}
          {researchGaps && researchGaps.length > 0 && (
            <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
              <h5 className="text-[#B4916C] font-safiro mb-3">Research Gaps</h5>
              <ul className="space-y-2 text-[#F9F6EE] font-borna">
                {researchGaps.map((gap: string, index: number) => (
                  <li key={index} className="flex">
                    <span className="text-[#B4916C] mr-2">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Future Work Suggestions */}
          {futureWorkSuggestions && futureWorkSuggestions.length > 0 && (
            <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
              <h5 className="text-[#B4916C] font-safiro mb-3">Future Research Directions</h5>
              <ul className="space-y-2 text-[#F9F6EE] font-borna">
                {futureWorkSuggestions.map((suggestion: string, index: number) => (
                  <li key={index} className="flex">
                    <span className="text-[#B4916C] mr-2">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Content Assessment */}
        {contentAssessment && (
          <div className="space-y-4">
            <h4 className="text-lg text-[#F9F6EE] font-safiro border-b border-[#333333] pb-2">
              Content Assessment
            </h4>
            <div className="bg-[#171717] rounded-xl p-4 border border-[#222222]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#F9F6EE] font-borna">Content Clarity</span>
                    <span className="text-[#B4916C] font-borna">{contentAssessment.clarity || 0}%</span>
                  </div>
                  <div className="w-full bg-[#333333] rounded-full h-2.5">
                    <div 
                      className="bg-[#B4916C] h-2.5 rounded-full" 
                      style={{ width: `${contentAssessment.clarity || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#F9F6EE] font-borna">Technical Depth</span>
                    <span className="text-[#B4916C] font-borna">{contentAssessment.technicalDepth || 0}%</span>
                  </div>
                  <div className="w-full bg-[#333333] rounded-full h-2.5">
                    <div 
                      className="bg-[#B4916C] h-2.5 rounded-full" 
                      style={{ width: `${contentAssessment.technicalDepth || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#F9F6EE] font-borna">Graphics Quality</span>
                    <span className="text-[#B4916C] font-borna">{contentAssessment.graphicsQuality || 0}%</span>
                  </div>
                  <div className="w-full bg-[#333333] rounded-full h-2.5">
                    <div 
                      className="bg-[#B4916C] h-2.5 rounded-full" 
                      style={{ width: `${contentAssessment.graphicsQuality || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#111111] rounded-lg">
                    <div className="text-[#C5C2BA] text-sm mb-1">Audience Level</div>
                    <div className="text-[#F9F6EE] font-borna">{contentAssessment.audienceLevel || "Academic"}</div>
                  </div>
                  <div className="p-3 bg-[#111111] rounded-lg">
                    <div className="text-[#C5C2BA] text-sm mb-1">Jargon Level</div>
                    <div className="text-[#F9F6EE] font-borna">{contentAssessment.jargonLevel || "Moderate"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="w-full">
      <div className="space-y-4">
        <div className="mb-4">
          <label className="block mb-2 text-[#F9F6EE] font-borna">Select Document</label>
          <DocSelector
            documents={documents}
            value={selectedDocumentId}
            onChange={setSelectedDocumentId}
          />
        </div>
        
        {selectedDocument && !isSelectedDocumentPdf && (
          <Alert
            message="PDF Only"
            description="This analyzer works with PDF documents only. Please select a PDF document."
            type="warning"
            showIcon
            className="bg-[#3A361F] border border-[#E5D373]/30 text-[#F9F6EE]"
          />
        )}
        
        {selectedDocument && isSelectedDocumentPdf && (
          <DocumentPurposeSelector
            value={documentPurpose}
            onChange={setDocumentPurpose}
          />
        )}
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedDocumentId || (selectedDocument && !isSelectedDocumentPdf)}
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
          </div>
        ) : (
          <EmptyDocumentState />
        )}
      </div>
    </div>
  );
} 