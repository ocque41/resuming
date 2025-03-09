"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComboboxPopover } from "@/components/ui/combobox";
import { AlertCircle, Download, Eye, RefreshCw, Check, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface EnhancedCVPreviewProps {
  cvs?: string[]; // Format: "filename|id"
}

export default function EnhancedCVPreview({ cvs = [] }: EnhancedCVPreviewProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [cvOptions, setCvOptions] = useState<string[]>(cvs);
  
  // State for preview process
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  
  // State for accent color
  const [accentColor, setAccentColor] = useState<string>("#B4916C");
  
  // ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(65);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(85);
  
  // Preview iframe ref
  const previewRef = useRef<HTMLIFrameElement>(null);
  
  // Extract display names for the CV dropdown (without the ID part)
  const displayCVOptions = cvOptions.map(cv => {
    const parts = cv.split('|');
    return parts[0].trim();
  });
  
  // Fetch CVs if none provided
  React.useEffect(() => {
    const fetchCVs = async () => {
      try {
        // If cvs prop is provided, use it
        if (cvs.length > 0) {
          setCvOptions(cvs);
          return;
        }
        
        // Otherwise fetch from API
        const response = await fetch('/api/cv-list');
        if (!response.ok) {
          throw new Error('Failed to fetch CV list');
        }
        
        const data = await response.json();
        
        if (data.cvs && Array.isArray(data.cvs)) {
          // Format the CVs as "filename|id"
          const formattedCVs = data.cvs.map((cv: any) => {
            return `${cv.fileName}|${cv.id}`;
          });
          
          setCvOptions(formattedCVs);
        } else {
          console.error('Invalid CV data format:', data);
          setError('Failed to load CV list: Invalid data format');
        }
      } catch (error) {
        console.error('Error fetching CV list:', error);
        setError(`Failed to load CV list: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    fetchCVs();
  }, [cvs]);
  
  // Handle CV selection
  const handleCVSelect = useCallback((cv: string) => {
    // Find the original CV string with ID
    const originalCVString = cvOptions.find(item => item.startsWith(cv + '|'));
    
    if (originalCVString) {
      const parts = originalCVString.split('|');
      const fileName = parts[0].trim();
      const id = parts[1].trim();
      
      console.log(`Selected CV: ${fileName}, ID: ${id}`);
      setSelectedCV(fileName);
      setCvOptions(prev => [...prev, `${fileName}|${id}`]);
    } else {
      console.log("Could not find ID for selected CV, using display name only");
      setSelectedCV(cv);
      setCvOptions(prev => [...prev, `${cv}|`]);
    }
  }, [cvOptions]);
  
  // Function to handle generating the enhanced CV preview
  const handlePreview = useCallback(async () => {
    if (!selectedCV) {
      setError("Please select a CV to preview");
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      
      // Extract the CV ID from the selected CV
      const cvParts = selectedCV.split('|');
      const fileName = cvParts[0].trim();
      let cvId = cvParts.length > 1 ? cvParts[1].trim() : undefined;
      
      // Prepare the request data
      const requestData: any = {
        accentColor
      };
      
      // If we have a CV ID, use it
      if (cvId) {
        requestData.cvId = cvId;
      } 
      // If we don't have a CV ID, we need to search by filename
      else {
        // First try to find the CV ID for this filename in our options
        const matchingCV = cvOptions.find(cv => cv.startsWith(fileName + '|'));
        if (matchingCV) {
          const parts = matchingCV.split('|');
          if (parts.length > 1) {
            cvId = parts[1].trim();
            requestData.cvId = cvId;
          }
        }
        
        // If we still don't have a CV ID, use the filename
        if (!requestData.cvId) {
          requestData.fileName = fileName;
          // As a fallback, we can also provide dummy text
          requestData.rawText = "This is a preview of the CV with enhanced formatting.";
        }
      }
      
      // Call the preview API
      const response = await fetch('/api/cv/preview-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate enhanced preview');
      }
      
      const data = await response.json();
      
      // Set ATS scores
      if (data.originalAtsScore) {
        setOriginalAtsScore(data.originalAtsScore);
      }
      
      if (data.improvedAtsScore) {
        setImprovedAtsScore(data.improvedAtsScore);
      }
      
      // Set PDF data
      if (data.pdfBase64) {
        setPdfData(data.pdfBase64);
        // Create a data URL for the PDF preview
        setPreviewSrc(`data:application/pdf;base64,${data.pdfBase64}`);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error generating enhanced preview:", error);
      setError(`Enhanced preview error: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  }, [selectedCV, accentColor, cvOptions]);
  
  // Function to handle downloading the PDF
  const handleDownload = useCallback(() => {
    if (!pdfData) {
      setError("No PDF data available for download");
      return;
    }
    
    try {
      // Create a link element for download
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfData}`;
      
      // Set the download attribute with a filename
      const fileName = selectedCV ? selectedCV.split('|')[0].trim() : 'enhanced-cv';
      link.download = `${fileName}-enhanced.pdf`;
      
      // Append to the document
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Remove the link
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      setError(`PDF download error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pdfData, selectedCV]);
  
  // Preset accent colors
  const presetColors = [
    "#B4916C", // Default gold
    "#4A6FA5", // Blue
    "#4CAF50", // Green
    "#F44336", // Red
    "#9C27B0", // Purple
    "#FF9800", // Orange
  ];
  
  return (
    <Card className="w-full shadow-lg border-0">
      <CardHeader className="bg-[#121212] text-white rounded-t-lg">
        <CardTitle className="text-[#B4916C] flex items-center gap-2">
          <Eye className="h-5 w-5" />
          <span>Enhanced CV Preview</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* CV Selection */}
        <div className="mb-4">
          <ComboboxPopover
            label="Select CV to Preview"
            options={displayCVOptions}
            onSelect={handleCVSelect}
            accentColor="#B4916C"
          />
        </div>
        
        {/* Style Options */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Accent Color</h3>
          <div className="flex flex-wrap gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full transition-all ${
                  accentColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setAccentColor(color)}
                aria-label={`Set accent color to ${color}`}
              >
                {accentColor === color && (
                  <Check className="text-white h-4 w-4 mx-auto" />
                )}
              </button>
            ))}
            <div className="relative">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="sr-only"
                id="custom-color"
              />
              <label
                htmlFor="custom-color"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 cursor-pointer hover:bg-gray-600 transition-colors"
              >
                <span className="text-xs text-white">+</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Action Button */}
        <Button 
          onClick={handlePreview}
          disabled={isLoading || !selectedCV}
          className="w-full mb-4 bg-[#B4916C] hover:bg-[#A3815C] text-white"
        >
          {isLoading ? (
            <>
              <span className="mr-2">Generating Preview...</span>
              <RefreshCw className="h-4 w-4 animate-spin" />
            </>
          ) : (
            <>
              <span>Generate Enhanced Preview</span>
              <Eye className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
        
        {/* Error Message */}
        {error && (
          <Alert className="mb-4 bg-red-900/20 text-red-400 border border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Preview Content */}
        {previewSrc && (
          <div className="mt-4">
            {/* ATS Score Comparison */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Original ATS Score</h3>
                <div className="w-20 h-20">
                  <CircularProgressbar
                    value={originalAtsScore}
                    text={`${originalAtsScore}%`}
                    styles={buildStyles({
                      textSize: '1.5rem',
                      pathColor: '#F44336',
                      textColor: '#F44336',
                      trailColor: '#333333',
                    })}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Enhanced ATS Score</h3>
                <div className="w-20 h-20">
                  <CircularProgressbar
                    value={improvedAtsScore}
                    text={`${improvedAtsScore}%`}
                    styles={buildStyles({
                      textSize: '1.5rem',
                      pathColor: '#4CAF50',
                      textColor: '#4CAF50',
                      trailColor: '#333333',
                    })}
                  />
                </div>
              </div>
            </div>
            
            {/* PDF Preview */}
            <div className="border border-gray-700 rounded-lg overflow-hidden h-[500px] mb-4">
              <iframe 
                ref={previewRef}
                src={previewSrc} 
                className="w-full h-full"
                title="Enhanced CV Preview"
              />
            </div>
            
            {/* Download Button */}
            <Button 
              onClick={handleDownload}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white"
              disabled={!pdfData}
            >
              <Download className="h-4 w-4 mr-2" />
              <span>Download Enhanced PDF</span>
            </Button>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="bg-[#121212] p-4 border-t border-gray-800 rounded-b-lg">
        <div className="w-full text-center text-sm text-gray-500">
          Professional CV enhancement powered by AI
        </div>
      </CardFooter>
    </Card>
  );
} 