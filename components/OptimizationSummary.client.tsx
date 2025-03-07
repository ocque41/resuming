import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { ArrowRight, ArrowUp, ArrowDown, BarChart, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

interface OptimizationSummaryProps {
  fileName: string;
  showDetails?: boolean;
}

export default function OptimizationSummary({ fileName, showDetails = true }: OptimizationSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any>(null);

  useEffect(() => {
    if (!fileName) return;
    
    async function fetchSummary() {
      try {
        setLoading(true);
        
        const response = await fetch('/api/compare-ats-scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileName }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch optimization summary');
        }
        
        const data = await response.json();
        setSummaryData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSummary();
  }, [fileName]);

  // Helper to determine score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50'; // Green for excellent
    if (score >= 70) return '#8bc34a'; // Light green for good
    if (score >= 60) return '#ffc107'; // Amber for moderate
    if (score >= 50) return '#ff9800'; // Orange for needs improvement
    return '#f44336'; // Red for poor
  };

  // Helper to get difference indicator
  const getDifferenceIndicator = (difference: number) => {
    if (difference > 0) return <ArrowUp className="text-green-500" />;
    if (difference < 0) return <ArrowDown className="text-red-500" />;
    return <ArrowRight className="text-gray-500" />;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Optimization Summary</CardTitle>
          <CardDescription>Loading optimization data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-pulse h-48 w-48 rounded-full bg-gray-200"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Optimization Summary</CardTitle>
          <CardDescription>Could not load summary</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </CardFooter>
      </Card>
    );
  }

  if (!summaryData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Optimization Summary</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>No comparison available</AlertTitle>
            <AlertDescription>
              This CV has not been optimized yet or analysis data is not available.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>CV Optimization Results</CardTitle>
        <CardDescription>
          ATS Score comparison between original and optimized CV
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 mb-6">
          {/* Original ATS Score */}
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium mb-2">Original CV</h3>
            <div className="w-32 h-32">
              <CircularProgressbar
                value={summaryData.originalAtsScore || 0}
                text={`${summaryData.originalAtsScore || 0}%`}
                styles={buildStyles({
                  pathColor: getScoreColor(summaryData.originalAtsScore || 0),
                  textColor: getScoreColor(summaryData.originalAtsScore || 0),
                  trailColor: '#e2e8f0',
                })}
              />
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            {getDifferenceIndicator(summaryData.difference || 0)}
            <span className="text-lg font-bold mx-2">
              {summaryData.difference > 0 ? '+' : ''}
              {summaryData.difference || 0}%
            </span>
          </div>

          {/* Optimized ATS Score */}
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium mb-2">Optimized CV</h3>
            <div className="w-32 h-32">
              <CircularProgressbar
                value={summaryData.optimizedAtsScore || 0}
                text={`${summaryData.optimizedAtsScore || 0}%`}
                styles={buildStyles({
                  pathColor: getScoreColor(summaryData.optimizedAtsScore || 0),
                  textColor: getScoreColor(summaryData.optimizedAtsScore || 0),
                  trailColor: '#e2e8f0',
                })}
              />
            </div>
          </div>
        </div>

        {/* Comparison Summary */}
        <div className="mt-4">
          <Alert className={`mb-4 ${summaryData.difference >= 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
            {summaryData.difference >= 0 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <AlertTitle className={summaryData.difference >= 0 ? 'text-green-800' : 'text-amber-800'}>
              {summaryData.comparison}
            </AlertTitle>
            <AlertDescription>
              Your CV's ATS compatibility has {summaryData.difference >= 0 ? 'improved' : 'decreased'} by {Math.abs(summaryData.difference || 0)}%.
            </AlertDescription>
          </Alert>
        </div>

        {/* Recommendations */}
        {showDetails && summaryData.recommendedActions && summaryData.recommendedActions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <BarChart className="w-5 h-5 mr-2" />
              Recommended Actions
            </h3>
            <ul className="space-y-2 list-disc list-inside">
              {summaryData.recommendedActions.map((action: string, index: number) => (
                <li key={index} className="text-sm">{action}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh Data
        </Button>
      </CardFooter>
    </Card>
  );
} 