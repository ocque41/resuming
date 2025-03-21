"use client";

import React, { useState, useEffect } from "react";
import { Select, Button, Alert, Spin, Tabs, Card, Progress, Collapse, Empty, Tooltip, List, Avatar, Modal, Upload, message } from "antd";
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
  CheckOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  InboxOutlined,
  ThunderboltOutlined
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
  createdAt: string;
  filePath?: string;
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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentList, setDocumentList] = useState<Document[]>(documents);
  
  // Upload props configuration for Ant Design Upload component
  const { Dragger } = Upload;
  
  // Function to fetch documents from the server
  const fetchDocuments = () => {
    setIsLoadingDocuments(true);
    fetch('/api/cv/list')
      .then(res => res.json())
      .then(data => {
        setDocumentList(data.documents || []);
        setIsLoadingDocuments(false);
      })
      .catch(err => {
        console.error('Error fetching documents:', err);
        setIsLoadingDocuments(false);
      });
  };
  
  const uploadProps = {
    name: 'file',
    multiple: false,
    action: '/api/cv/upload',
    onChange(info: any) {
      if (info.file.status === 'done') {
        // Handle successful upload
        message.success(`${info.file.name} uploaded successfully`);
        // Refresh documents list
        fetchDocuments();
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} upload failed.`);
      }
    },
    beforeUpload: (file: File) => {
      const isValidType = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ].includes(file.type);
      
      if (!isValidType) {
        message.error('You can only upload PDF, DOC, DOCX or TXT files!');
      }
      
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('File must be smaller than 5MB!');
      }
      
      return isValidType && isLt5M;
    }
  };
  
  // Get the selected document's file name
  const selectedDocument = documentList.find(doc => doc.id === selectedDocumentId);
  
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
  
  // Function to get file type icon based on file name
  const getFileTypeIcon = (fileName: string) => {
    const fileType = getFileTypeFromName(fileName);
    if (!fileType) return <FileSearchOutlined />;
    
    switch (fileType.name) {
      case 'pdf':
        return <FileSearchOutlined style={{ color: '#e74c3c' }} />;
      case 'doc':
      case 'docx':
        return <FileSearchOutlined style={{ color: '#3498db' }} />;
      case 'txt':
        return <FileSearchOutlined style={{ color: '#95a5a6' }} />;
      default:
        return <FileSearchOutlined />;
    }
  };
  
  // Function to determine file type from file name
  const getFileTypeFromName = (fileName: string) => {
    if (!fileName) return null;
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return { name: 'pdf', category: 'document' };
      case 'doc':
      case 'docx':
        return { name: 'doc', category: 'document' };
      case 'txt':
        return { name: 'txt', category: 'document' };
      default:
        return { name: 'unknown', category: 'other' };
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
        <Card title="Document Quality Breakdown" className="border-[#222222] bg-[#111111]">
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
              <PolarGrid stroke="#333333" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#F9F6EE" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#F9F6EE" }} />
              <Radar 
                name="Document Quality" 
                dataKey="score" 
                stroke="#B4916C" 
                fill="#B4916C" 
                fillOpacity={0.6}
              />
              <RechartsTooltip formatter={(value: number) => `${value}/100`} />
              <Legend wrapperStyle={{ color: "#F9F6EE" }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Key Points" className="border-[#222222] bg-[#111111]">
          <List
            dataSource={analysisResult.keyPoints || []}
            renderItem={(item: string, index: number) => (
              <List.Item className="border-b border-[#222222] last:border-0">
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: '#B4916C' }}>{index + 1}</Avatar>}
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
        <Card title="Document Sentiment" className="border-[#222222] bg-[#111111]">
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
            <div className="mt-2 text-sm text-[#C5C2BA]">
              Sentiment Score: {Math.round(analysisResult.sentiment.score * 100)}%
            </div>
          </div>
        </Card>
        
        <Card title="Language Quality" className="border-[#222222] bg-[#111111]">
          {analysisResult.languageQuality && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(analysisResult.languageQuality).map(([key, value]: [string, any]) => (
                <div key={key} className="text-center">
                  <div className="mb-2 text-sm text-[#C5C2BA] capitalize">{key}</div>
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
        
        <Card title="Top Topics" className="border-[#222222] bg-[#111111]">
          {analysisResult.topics && analysisResult.topics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysisResult.topics.slice(0, 6).map((topic: any, index: number) => (
                <div key={`topic-${index}`} className="bg-[#222222] p-3 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium text-[#F9F6EE]">{topic.name}</div>
                    <div className="text-sm text-[#C5C2BA]">{Math.round(topic.relevance * 100)}%</div>
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
          <Card title="Document Type" className="text-center border-[#222222] bg-[#111111]">
            <div className="text-2xl font-bold mb-3 text-[#F9F6EE]">
              {fileType.name === 'pdf' && selectedDocument?.fileName.toLowerCase().includes('cv') ? 'CV / Resume' : 'Document'}
            </div>
            <div className="text-[#C5C2BA]">
              {`File type: ${fileType.name.toUpperCase()} • Created: ${new Date(selectedDocument?.createdAt || Date.now()).toLocaleDateString()}`}
            </div>
          </Card>
          
          <Card title="Recommendations" className="border-[#222222] bg-[#111111]">
            <List
              dataSource={analysisResult.recommendations || []}
              renderItem={(item: string, index: number) => (
                <List.Item className="border-b border-[#222222] last:border-0">
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        style={{ backgroundColor: '#B4916C' }}
                        icon={<CheckOutlined />}
                      />
                    }
                    title={<span className="text-[#F9F6EE]">{item}</span>}
                  />
                </List.Item>
              )}
            />
          </Card>
          
          <Card title="Top Topics" className="border-[#222222] bg-[#111111]">
            {analysisResult.topics && analysisResult.topics.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {analysisResult.topics.slice(0, 9).map((topic: {name: string, relevance: number}, index: number) => (
                  <div 
                    key={`topic-tag-${index}`} 
                    className="py-1 px-3 rounded-full text-center text-sm"
                    style={{
                      backgroundColor: '#333333',
                      color: '#F9F6EE',
                      border: '1px solid #B4916C'
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
        <Card title="Document Information" className="border-[#222222] bg-[#111111]">
          <table className="min-w-full">
            <tbody>
              <tr className="border-b border-[#222222]">
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider w-1/3">File Name</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">{selectedDocument?.fileName}</td>
              </tr>
              <tr className="border-b border-[#222222]">
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">File Type</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">{fileType?.name.toUpperCase()}</td>
              </tr>
              <tr className="border-b border-[#222222]">
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">Created</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">{new Date(selectedDocument?.createdAt || Date.now()).toLocaleString()}</td>
              </tr>
              <tr className="border-b border-[#222222]">
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">Analysis Type</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE] capitalize">{analysisType}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-left text-xs font-medium text-[#C5C2BA] uppercase tracking-wider">Overall Quality</td>
                <td className="px-6 py-3 text-left text-sm text-[#F9F6EE]">
                  <Progress 
                    percent={analysisResult.insights?.overallScore || 0} 
                    size="small" 
                    status={(analysisResult.insights?.overallScore || 0) >= 70 ? "success" : (analysisResult.insights?.overallScore || 0) >= 40 ? "normal" : "exception"} 
                    strokeColor="#B4916C"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        
        <Card title="Key Points" className="border-[#222222] bg-[#111111]">
          <List
            dataSource={analysisResult.keyPoints || []}
            renderItem={(item: string, index: number) => (
              <List.Item className="border-b border-[#222222] last:border-0">
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: '#B4916C' }}>{index + 1}</Avatar>}
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
        <Card title="Document Analysis Summary" className="mb-4 border-[#222222] bg-[#111111]">
          <div className="py-3 px-4 bg-[#222222] rounded-md mb-4">
            <p className="text-[#F9F6EE]">{analysisResult.summary}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold mb-3 text-[#F9F6EE]">Key Points</h3>
              <ul className="list-disc pl-5 text-[#F9F6EE]">
                {analysisResult.keyPoints?.map((point: string, index: number) => (
                  <li key={`point-${index}`} className="mb-2">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-3 text-[#F9F6EE]">Recommendations</h3>
              <ul className="list-disc pl-5 text-[#F9F6EE]">
                {analysisResult.recommendations?.map((recommendation: string, index: number) => (
                  <li key={`recommendation-${index}`} className="mb-2">
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        
        <Card title="Document Quality Insights" className="border-[#222222] bg-[#111111]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {analysisResult.insights && Object.entries(analysisResult.insights).map(([key, value]: [string, any], index) => {
              // Skip overallScore as we'll display it prominently
              if (key === 'overallScore') return null;
              
              return (
                <div key={key} className="bg-[#222222] p-3 rounded-md text-center">
                  <div className="text-sm text-[#C5C2BA] capitalize mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div className="text-lg font-semibold text-[#F9F6EE]">
                    <Progress percent={value} size="small" showInfo={false} strokeColor="#B4916C" />
                    <span className="mt-1 inline-block">{value}/100</span>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-center mb-4">
            <Progress
              type="circle"
              percent={analysisResult.insights?.overallScore || 0}
              format={(percent) => <span className="text-[#F9F6EE]">{percent}</span>}
              strokeColor={{
                '0%': '#B4916C',
                '100%': '#B4916C',
              }}
              width={120}
            />
          </div>
          
          <p className="text-center text-[#C5C2BA]">
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F9F6EE] mb-2">Document Analysis</h1>
          <p className="text-[#C5C2BA]">Upload documents to analyze content and get insights</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button
            onClick={() => setIsUploadModalOpen(true)}
            type="primary"
            icon={<UploadOutlined />}
            style={{ backgroundColor: '#B4916C', borderColor: '#B4916C' }}
          >
            Upload Document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document Selection Sidebar */}
        <div className="lg:col-span-3">
          <Card title="My Documents" className="border-[#222222] bg-[#111111] text-[#F9F6EE]">
            {isLoadingDocuments ? (
              <div className="py-10 text-center">
                <Spin tip="Loading documents..." />
              </div>
            ) : documentList.length === 0 ? (
              <Empty 
                description={
                  <span className="text-[#C5C2BA]">No documents found</span>
                }
              />
            ) : (
              <List
                dataSource={documentList}
                renderItem={(doc) => (
                  <List.Item
                    className={`cursor-pointer transition duration-200 border-b border-[#222222] last:border-0 ${
                      selectedDocument?.id === doc.id ? 'bg-[#333333]' : 'hover:bg-[#222222]'
                    }`}
                    onClick={() => setSelectedDocumentId(doc.id)}
                  >
                    <List.Item.Meta
                      avatar={getFileTypeIcon(doc.fileName)}
                      title={<span className="text-[#F9F6EE] truncate max-w-[200px]">{doc.fileName}</span>}
                      description={
                        <span className="text-[#C5C2BA]">
                          {getFileTypeFromName(doc.fileName)?.name.toUpperCase()} • {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      }
                    />
                    {selectedDocument?.id === doc.id && (
                      <CheckCircleOutlined style={{ color: '#B4916C' }} className="ml-2" />
                    )}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>

        {/* Document Analysis Area */}
        <div className="lg:col-span-9">
          {selectedDocument ? (
            <Card className="border-[#222222] bg-[#111111]">
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    key: 'summary',
                    label: <span className="text-[#F9F6EE]">Summary</span>,
                    children: renderSummary(),
                  },
                  {
                    key: 'keyInfo',
                    label: <span className="text-[#F9F6EE]">Key Information</span>,
                    children: renderKeyInformation(),
                  },
                  {
                    key: 'sentiment',
                    label: <span className="text-[#F9F6EE]">Sentiment Analysis</span>,
                    children: renderSentimentAnalysis(),
                  },
                  {
                    key: 'contentAnalysis',
                    label: <span className="text-[#F9F6EE]">Content Analysis</span>,
                    children: renderContentAnalysis(),
                  },
                ]}
              />
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleAnalyze}
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={isAnalyzing}
                  style={{ backgroundColor: '#B4916C', borderColor: '#B4916C' }}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Document'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="text-center py-12 border-[#222222] bg-[#111111]">
              <div className="text-[#F9F6EE] mb-4">
                <FileSearchOutlined style={{ fontSize: 48 }} />
              </div>
              <h3 className="text-xl font-medium text-[#F9F6EE] mb-2">No Document Selected</h3>
              <p className="text-[#C5C2BA] mb-6">
                Select a document from the sidebar or upload a new one to analyze
              </p>
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                type="primary"
                icon={<UploadOutlined />}
                style={{ backgroundColor: '#B4916C', borderColor: '#B4916C' }}
              >
                Upload Document
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        title="Upload Document"
        open={isUploadModalOpen}
        onCancel={() => setIsUploadModalOpen(false)}
        footer={null}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        className="upload-document-modal"
        styles={{
          header: {
            backgroundColor: '#111111',
            borderBottom: '1px solid #222222',
          },
          body: {
            backgroundColor: '#111111',
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          },
          content: {
            backgroundColor: '#111111',
            borderRadius: '8px',
            border: '1px solid #222222',
          },
          footer: {
            backgroundColor: '#111111',
            borderTop: '1px solid #222222',
          }
        }}
      >
        <Dragger
          {...uploadProps}
          listType="picture"
          className="mt-4 bg-[#050505] border-[#222222] rounded-lg"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#B4916C' }} />
          </p>
          <p className="ant-upload-text text-[#F9F6EE]">
            Click or drag file to this area to upload
          </p>
          <p className="ant-upload-hint text-[#C5C2BA]">
            Support for .pdf, .doc, .docx, .txt, and other documents up to 5MB
          </p>
        </Dragger>
      </Modal>

      {/* Error Modal */}
      <Modal
        title={<span className="text-[#F9F6EE]">Analysis Error</span>}
        open={!!error}
        onCancel={() => setError('')}
        footer={[
          <Button 
            key="ok" 
            onClick={() => setError('')}
            style={{ backgroundColor: '#B4916C', borderColor: '#B4916C', color: '#F9F6EE' }}
          >
            OK
          </Button>
        ]}
        styles={{
          header: {
            backgroundColor: '#111111',
            borderBottom: '1px solid #222222',
          },
          body: {
            backgroundColor: '#111111',
            color: '#F9F6EE'
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          },
          content: {
            backgroundColor: '#111111',
            borderRadius: '8px',
            border: '1px solid #222222',
          },
          footer: {
            backgroundColor: '#111111',
            borderTop: '1px solid #222222',
          }
        }}
      >
        <div className="text-[#F9F6EE]">{error}</div>
      </Modal>
    </div>
  );
} 