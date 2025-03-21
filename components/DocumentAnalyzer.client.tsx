"use client";

import React, { useState } from "react";
import { Select, Button, Alert, Spin, Tabs, Card, Progress, Collapse, Empty, Tooltip } from "antd";
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
  Area
} from "recharts";
import { 
  FileTextOutlined, 
  FileExcelOutlined, 
  FilePptOutlined, 
  DownloadOutlined, 
  ShareAltOutlined 
} from "@ant-design/icons";
import { detectFileType, getAnalysisTypeForFile, FileTypeInfo } from "@/lib/file-utils/file-type-detector";

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
        className="w-full px-4 py-2 bg-[#111111] border border-[#222222] rounded-md text-[#F9F6EE] font-borna appearance-none focus:outline-none focus:ring-2 focus:ring-[#B4916C] focus:border-transparent"
      >
        <option value="" disabled>Select a document to analyze</option>
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("1");
  
  // Get the selected document's file name
  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);
  
  // Detect file type if we have a selected document
  const fileType = selectedDocument ? detectFileType(selectedDocument.fileName) : undefined;
  const analysisType = fileType ? getAnalysisTypeForFile(fileType) : "general";

  // Function to fetch document content by ID
  const fetchDocumentContent = async (documentId: string) => {
    try {
      const response = await fetch(`/api/cv/get-details?cvId=${documentId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch document content');
      }
      
      const data = await response.json();
      return data.rawText || '';
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
          setError("The document content could not be retrieved for analysis");
          setIsAnalyzing(false);
          return;
        }
      } catch (fetchError) {
        console.error("Error fetching document content:", fetchError);
        setError("Could not retrieve document content. Please try again.");
        setIsAnalyzing(false);
        return;
      }

      // Now send for analysis with the document content
      const response = await fetch(`/api/document/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          documentId: selectedDocumentId,
          documentText: documentText,
          fileName: selectedDocument?.fileName
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to analyze document");
      }

      const data = await response.json();
      setAnalysisResult(data.analysis || data);
    } catch (err) {
      console.error("Analysis error:", err);
      setError("An error occurred while analyzing the document");
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
  
  // Get a component to render based on the file type and analysis section
  const renderAnalysisSection = (section: string) => {
    if (!analysisResult) return null;
    
    switch (section) {
      case "content":
        return renderContentAnalysis();
      case "sentiment":
        return renderSentimentAnalysis();
      case "keyinfo":
        return renderKeyInformation();
      case "summary":
      default:
        return renderSummary();
    }
  };
  
  // Render content analysis based on file type
  const renderContentAnalysis = () => {
    if (!analysisResult?.contentAnalysis) {
      return <Empty description="No content analysis available" />;
    }
    
    switch (analysisType) {
      case 'spreadsheet':
  return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Data Structure">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analysisResult.contentAnalysis.dataStructure || analysisResult.contentAnalysis.contentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name: string, percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {(analysisResult.contentAnalysis.dataStructure || analysisResult.contentAnalysis.contentDistribution)?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => `${value}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            
            <Card title="Data Quality">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart outerRadius={90} width={500} height={300} data={analysisResult.contentAnalysis.dataQuality || []}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="attribute" />
                  <PolarGrid />
                  <Radar name="Score" dataKey="score" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <RechartsTooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
        </div>
        );
        
      case 'presentation':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Slide Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analysisResult.contentAnalysis.slideDistribution || analysisResult.contentAnalysis.contentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name: string, percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {(analysisResult.contentAnalysis.slideDistribution || analysisResult.contentAnalysis.contentDistribution)?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => `${value}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            
            <Card title="Content Flow">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analysisResult.contentAnalysis.contentFlow || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="slide" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="contentDensity" stroke="#8884d8" name="Content Density" />
                  <Line type="monotone" dataKey="complexityScore" stroke="#82ca9d" name="Complexity" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
                          </div>
        );
        
      case 'document':
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Content Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analysisResult.contentAnalysis.contentDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name: string, percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {analysisResult.contentAnalysis.contentDistribution?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => `${value}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              </Card>
              
            <Card title="Top Keywords">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analysisResult.contentAnalysis.topKeywords || []}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="text" />
                  <YAxis label={{ value: 'Relevance', angle: -90, position: 'insideLeft' }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="value" name="Relevance Score" fill="#8884d8">
                    {analysisResult.contentAnalysis.topKeywords?.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </Card>
            </div>
        );
    }
  };
  
  // Render sentiment analysis based on file type
  const renderSentimentAnalysis = () => {
    if (!analysisResult?.sentimentAnalysis) {
      return <Empty description="No sentiment analysis available" />;
    }
    
    // For now, sentiment analysis is similar across all file types
    return (
      <div className="grid grid-cols-1 gap-6">
        <Card title="Overall Sentiment">
          <div className="flex justify-center mb-6">
            <Progress
              type="dashboard"
              percent={Math.round((analysisResult.sentimentAnalysis.overallScore || 0) * 100)}
              format={(percent) => `${percent}%`}
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#faad14',
                '100%': '#52c41a',
              }}
            />
                </div>
                
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold mb-1">
              {(analysisResult.sentimentAnalysis.overallScore || 0) >= 0.8 
                ? "Very Positive" 
                : (analysisResult.sentimentAnalysis.overallScore || 0) >= 0.6 
                  ? "Positive" 
                  : (analysisResult.sentimentAnalysis.overallScore || 0) >= 0.4 
                    ? "Neutral" 
                    : "Needs Improvement"}
            </h3>
            <p className="text-gray-600">
              {(analysisResult.sentimentAnalysis.overallScore || 0) >= 0.7 
                ? "Your document uses strong, positive language that effectively communicates your message." 
                : (analysisResult.sentimentAnalysis.overallScore || 0) >= 0.5 
                  ? "Your document has a positive tone but could be strengthened in some areas." 
                  : "Consider revising to use more positive and confident language."}
            </p>
                      </div>
        </Card>
        
        <Card title="Sentiment by Section">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={analysisResult.sentimentAnalysis.sentimentBySection || []}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <YAxis dataKey="section" type="category" width={150} />
              <RechartsTooltip formatter={(value: any) => `${(Number(value) * 100).toFixed(0)}%`} />
              <Legend />
              <Bar dataKey="score" name="Sentiment Score" fill="#8884d8">
                {analysisResult.sentimentAnalysis.sentimentBySection?.map((entry: any) => (
                  <Cell 
                    key={`cell-${entry.section}`} 
                    fill={
                      entry.score >= 0.8 ? "#52c41a" : 
                      entry.score >= 0.6 ? "#85d13a" : 
                      entry.score >= 0.4 ? "#faad14" : 
                      "#ff4d4f"
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
                      </div>
    );
  };
  
  // Render key information based on file type
  const renderKeyInformation = () => {
    if (!analysisResult?.keyInformation) {
      return <Empty description="No key information available" />;
    }
    
    switch (analysisType) {
      case 'spreadsheet':
        return (
          <div className="grid grid-cols-1 gap-4">
            <Card title="Data Insights">
              <Collapse className="bg-transparent border-0">
                {analysisResult.keyInformation.dataInsights?.map((insight: any, index: number) => (
                  <Panel header={insight.title} key={`insight-${index}`}>
                    <p>{insight.description}</p>
                    {insight.metrics && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {Object.entries(insight.metrics).map(([key, value]: [string, any]) => (
                          <div key={key} className="bg-gray-50 p-3 rounded">
                            <div className="text-xs text-gray-500">{key}</div>
                            <div className="text-lg font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                    )}
                  </Panel>
                ))}
              </Collapse>
            </Card>
            
            <Card title="Data Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={analysisResult.keyInformation.dataDistribution || []}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        );
        
      case 'presentation':
        return (
          <div className="grid grid-cols-1 gap-4">
            <Card title="Presentation Clarity">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart outerRadius={90} width={500} height={300} data={analysisResult.keyInformation.clarityMetrics || []}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarGrid />
                  <Radar name="Score" dataKey="score" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <RechartsTooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            
            <Card title="Key Messages">
              <ul className="space-y-4">
                {analysisResult.keyInformation.keyMessages?.map((message: any, index: number) => (
                  <li key={`message-${index}`} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="font-semibold">{message.title}</div>
                    <div className="text-gray-600">{message.description}</div>
                  </li>
                ))}
              </ul>
            </Card>
                      </div>
        );
        
      case 'document':
      default:
        return (
          <div className="grid grid-cols-1 gap-4">
            <Card title="Contact Information">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysisResult.keyInformation.contactInfo?.map((item: any, index: number) => (
                    <tr key={`contact-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {(!analysisResult.keyInformation.contactInfo || analysisResult.keyInformation.contactInfo.length === 0) && (
                <p className="text-gray-500 p-4 text-center">No contact information detected</p>
              )}
            </Card>
            
            <Card title="Key Entities">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(analysisResult.keyInformation.entities || []).slice(0, 10)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="occurrences" name="Occurrences" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        );
    }
  };
  
  // Render summary based on file type
  const renderSummary = () => {
    if (!analysisResult?.summary) {
      return <Empty description="No summary available" />;
    }
    
    // The summary section is similar for all file types
    return (
      <div>
        <Card title="Document Analysis Summary" className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold mb-3">Key Highlights</h3>
              <ul className="list-disc pl-5">
                {analysisResult.summary.highlights?.map((highlight: string, index: number) => (
                  <li key={`highlight-${index}`} className="mb-2">
                    {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
            <div>
              <h3 className="text-lg font-bold mb-3">Improvement Suggestions</h3>
              <ul className="list-disc pl-5">
                {analysisResult.summary.suggestions?.map((suggestion: string, index: number) => (
                  <li key={`suggestion-${index}`} className="mb-2">
                    {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
          </div>
        </Card>
        
        <Card title="Overall Quality Score">
          <div className="flex justify-center mb-6">
            <Progress
              type="circle"
              percent={analysisResult.summary.overallScore || 0}
              format={(percent) => `${percent}`}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              width={120}
            />
                    </div>
          <p className="text-center text-gray-600">
            {(analysisResult.summary.overallScore || 0) >= 80 
              ? "Excellent quality! Your document is well-structured and effective." 
              : (analysisResult.summary.overallScore || 0) >= 60 
                ? "Good quality with some room for improvement." 
                : "Several improvements could enhance your document's effectiveness."}
          </p>
        </Card>
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
                <TabPane tab="Summary" key="1">
                  {renderAnalysisSection("summary")}
                </TabPane>
                <TabPane tab="Content Analysis" key="2">
                  {renderAnalysisSection("content")}
                </TabPane>
                <TabPane tab="Sentiment" key="3">
                  {renderAnalysisSection("sentiment")}
                </TabPane>
                <TabPane tab="Key Information" key="4">
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