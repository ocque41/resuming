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

      console.log(`Sending document for analysis, text length: ${documentText.length} characters`);
      
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
        
        <Card title="Top Topics">
          {analysisResult.topics && analysisResult.topics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysisResult.topics.slice(0, 6).map((topic: any, index: number) => (
                <div key={`topic-${index}`} className="bg-[#222222] p-3 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium text-[#F9F6EE]">{topic.name}</div>
                    <div className="text-sm text-[#B4916C]">{Math.round(topic.relevance * 100)}%</div>
                  </div>
                  <Progress percent={Math.round(topic.relevance * 100)} size="small" strokeWidth={4} strokeColor="#B4916C" />
                </div>
              ))}
            </div>
          ) : (
            <Empty description="No topics detected" />
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
    if (fileType?.category === 'document' && analysisResult.insights) {
      return (
        <div className="grid grid-cols-1 gap-4">
          <Card title="Document Type" className="text-center">
            <div className="text-2xl font-bold mb-3">
              {fileType.name === 'pdf' && selectedDocument?.fileName.toLowerCase().includes('cv') ? 'CV / Resume' : 'Document'}
            </div>
            <div className="text-gray-500">
              {`File type: ${fileType.name.toUpperCase()} • Created: ${new Date(selectedDocument?.createdAt || Date.now()).toLocaleDateString()}`}
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
          
          <Card title="Top Topics">
            {analysisResult.topics && analysisResult.topics.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {analysisResult.topics.slice(0, 9).map((topic: {name: string, relevance: number}, index: number) => (
                  <div 
                    key={`topic-tag-${index}`} 
                    className="py-1 px-3 rounded-full text-center text-sm"
                    style={{
                      backgroundColor: `${COLORS[index % COLORS.length]}20`,
                      color: COLORS[index % COLORS.length],
                      border: `1px solid ${COLORS[index % COLORS.length]}`
                    }}
                  >
                    {topic.name} ({Math.round(topic.relevance * 100)}%)
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No topics detected" />
            )}
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
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">File Name</td>
                <td className="px-6 py-3 text-left text-sm text-gray-900">{selectedDocument?.fileName}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Type</td>
                <td className="px-6 py-3 text-left text-sm text-gray-900">{fileType?.name.toUpperCase()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</td>
                <td className="px-6 py-3 text-left text-sm text-gray-900">{new Date(selectedDocument?.createdAt || Date.now()).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Analysis Type</td>
                <td className="px-6 py-3 text-left text-sm text-gray-900 capitalize">{analysisType}</td>
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
                <TabPane tab="Overview" key="1">
                  {renderAnalysisSection("summary")}
                </TabPane>
                <TabPane tab="Quality Insights" key="2">
                  {renderAnalysisSection("content")}
                </TabPane>
                <TabPane tab="Sentiment & Language" key="3">
                  {renderAnalysisSection("sentiment")}
                </TabPane>
                <TabPane tab={fileType?.category === 'document' && selectedDocument?.fileName.toLowerCase().includes('cv') ? "CV Details" : "Document Details"} key="4">
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