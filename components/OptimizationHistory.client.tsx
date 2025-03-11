'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Download, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { getOptimizationHistory, getHistoryVersion, getCacheAge } from "@/lib/cache/documentCache";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OptimizationHistoryProps {
  cvId: string | null;
  onSelectVersion: (version: number) => void;
  onDownloadVersion: (version: number, format: 'pdf' | 'docx' | 'doc') => void;
  currentVersion?: number;
}

export default function OptimizationHistory({
  cvId,
  onSelectVersion,
  onDownloadVersion,
  currentVersion = 0
}: OptimizationHistoryProps) {
  const [history, setHistory] = useState<{
    versions: any[];
    currentVersion: number;
  } | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Load history when CV ID changes
  useEffect(() => {
    if (!cvId) {
      setHistory(null);
      return;
    }
    
    setLoading(true);
    const historyData = getOptimizationHistory(cvId);
    setHistory(historyData);
    
    if (historyData && historyData.currentVersion > 0) {
      setSelectedVersion(historyData.currentVersion);
    } else {
      setSelectedVersion(0);
    }
    
    setLoading(false);
  }, [cvId]);
  
  // Handle version selection
  const handleVersionChange = (value: string) => {
    const version = parseInt(value, 10);
    setSelectedVersion(version);
    onSelectVersion(version);
  };
  
  if (!cvId || !history || history.versions.length === 0) {
    return (
      <Card className="bg-[#0A0A0A] border-gray-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Clock className="mr-2 h-5 w-5 text-[#B4916C]" />
            Optimization History
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-gray-400">
          {loading ? 'Loading history...' : 'No optimization history available for this CV.'}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-[#0A0A0A] border-gray-800 shadow-xl">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Clock className="mr-2 h-5 w-5 text-[#B4916C]" />
          Optimization History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
            <div>
              <label htmlFor="version-select" className="block text-sm text-gray-400 mb-1">
                Select Version
              </label>
              <Select 
                value={selectedVersion.toString()} 
                onValueChange={handleVersionChange}
              >
                <SelectTrigger id="version-select" className="w-full md:w-60 bg-[#050505] border-gray-700 text-gray-300">
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent className="bg-[#050505] border-gray-700">
                  {history.versions.map((version, index) => (
                    <SelectItem 
                      key={index} 
                      value={(index + 1).toString()}
                      className="text-gray-300 focus:bg-gray-800 focus:text-white"
                    >
                      Version {index + 1} ({getCacheAge(version.timestamp)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="icon"
                className="bg-[#050505] text-gray-300 border-gray-700 h-8 w-8 rounded-full"
                disabled={selectedVersion <= 1}
                onClick={() => handleVersionChange((selectedVersion - 1).toString())}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Previous</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="bg-[#050505] text-gray-300 border-gray-700 h-8 w-8 rounded-full"
                disabled={selectedVersion >= history.versions.length}
                onClick={() => handleVersionChange((selectedVersion + 1).toString())}
              >
                <ArrowRight className="h-4 w-4" />
                <span className="sr-only">Next</span>
              </Button>
            </div>
          </div>
          
          {selectedVersion > 0 && selectedVersion <= history.versions.length && (
            <div className="p-4 bg-[#050505] rounded-md border border-gray-800">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg text-white font-medium">Version {selectedVersion}</h3>
                  <div className="flex items-center text-xs text-gray-400 mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    <time dateTime={new Date(history.versions[selectedVersion - 1].timestamp).toISOString()}>
                      {new Date(history.versions[selectedVersion - 1].timestamp).toLocaleDateString()} at {new Date(history.versions[selectedVersion - 1].timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-2">
                  <span className="text-gray-400 text-sm mr-1">ATS:</span>
                  <span className="text-[#B4916C] font-medium">
                    {history.versions[selectedVersion - 1].improvedAtsScore}%
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
                  onClick={() => onDownloadVersion(selectedVersion, 'pdf')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 hover:bg-gray-700 text-white"
                  onClick={() => onDownloadVersion(selectedVersion, 'docx')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  DOCX
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 hover:bg-gray-700 text-white"
                  onClick={() => onDownloadVersion(selectedVersion, 'doc')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  DOC
                </Button>
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-500 mt-4">
            The system keeps the last {history.versions.length} optimization versions. Older versions may be automatically removed.
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 