import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { ArrowRight, ArrowUp, ArrowDown, BarChart, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

// Brand colors
const BRAND_PRIMARY = '#B4916C'; // Amber/gold brand color
const BRAND_PRIMARY_LIGHT = 'rgba(180, 145, 108, 0.1)'; // Lighter version for backgrounds
const BRAND_SUCCESS = '#4caf50'; // Green for success
const BRAND_WARNING = '#ff9800'; // Orange for warnings
const BRAND_DANGER = '#f44336'; // Red for errors
const BRAND_NEUTRAL = '#64748b'; // Neutral color for general use

interface OptimizationSummaryProps {
  fileName: string;
  showDetails?: boolean;
  onUpdateDashboard?: (atsScore: number) => void; // New prop for updating dashboard
}

export default function OptimizationSummary({ 
  fileName, 
  showDetails = true,
  onUpdateDashboard
}: OptimizationSummaryProps) {
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
        
        // If we have optimized score and the parent wants updates, call the callback
        if (data.optimizedAtsScore && onUpdateDashboard) {
          onUpdateDashboard(data.optimizedAtsScore);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSummary();
  }, [fileName, onUpdateDashboard]);

  // Helper to determine score color using brand colors
  const getScoreColor = (score: number) => {
    if (score >= 80) return BRAND_SUCCESS;
    if (score >= 70) return BRAND_PRIMARY;
    if (score >= 60) return BRAND_WARNING;
    if (score >= 50) return '#ff9800'; // Orange
    return BRAND_DANGER;
  };

  // Helper to get difference indicator with brand colors
  const getDifferenceIndicator = (difference: number) => {
    if (difference > 0) return <ArrowUp className="text-green-500" />;
    if (difference < 0) return <ArrowDown className="text-red-500" />;
    return <ArrowRight className="text-gray-500" />;
  };

  if (loading) {
    return (
      <Card className="w-full border border-border/40 shadow-sm bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-primary">Optimization Summary</CardTitle>
          <CardDescription>Loading optimization data...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-pulse h-48 w-48 rounded-full bg-muted/50"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border border-border/40 shadow-sm bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-primary">Optimization Summary</CardTitle>
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
      <Card className="w-full border border-border/40 shadow-sm bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-primary">Optimization Summary</CardTitle>
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
    <Card className="w-full border border-border/40 shadow-sm bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold" style={{ color: BRAND_PRIMARY }}>
          CV Optimization Results
        </CardTitle>
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
                  trailColor: 'rgba(100, 116, 139, 0.2)', // Slate-colored trail
                })}
              />
            </div>
          </div>

          {/* Arrow with brand styling */}
          <div className="flex items-center my-4 lg:my-0 bg-muted/30 px-4 py-2 rounded-full">
            {summaryData.difference > 0 ? (
              <ArrowUp className="text-green-500 h-5 w-5 mr-2" />
            ) : summaryData.difference < 0 ? (
              <ArrowDown className="text-red-500 h-5 w-5 mr-2" />
            ) : (
              <ArrowRight className="text-gray-500 h-5 w-5 mr-2" />
            )}
            <span 
              className="text-lg font-bold" 
              style={{ 
                color: summaryData.difference > 0 
                  ? BRAND_SUCCESS 
                  : summaryData.difference < 0 
                    ? BRAND_DANGER 
                    : BRAND_NEUTRAL
              }}
            >
              {summaryData.difference > 0 ? '+' : ''}
              {summaryData.difference || 0}%
            </span>
          </div>

          {/* Optimized ATS Score with brand styling */}
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium mb-2" style={{ color: BRAND_PRIMARY }}>
              Optimized CV
            </h3>
            <div className="w-32 h-32">
              <CircularProgressbar
                value={summaryData.optimizedAtsScore || 0}
                text={`${summaryData.optimizedAtsScore || 0}%`}
                styles={buildStyles({
                  pathColor: getScoreColor(summaryData.optimizedAtsScore || 0),
                  textColor: getScoreColor(summaryData.optimizedAtsScore || 0),
                  trailColor: 'rgba(100, 116, 139, 0.2)',
                  // Add brand-specific styling
                  pathTransition: 'stroke-dashoffset 0.5s ease 0s',
                })}
              />
            </div>
          </div>
        </div>

        {/* Comparison Summary with brand styling */}
        <div className="mt-4">
          <Alert 
            className={`mb-4 ${
              summaryData.difference >= 0 
                ? `bg-${BRAND_PRIMARY_LIGHT} border-${BRAND_PRIMARY}/20`
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            {summaryData.difference >= 0 ? (
              <CheckCircle className="h-4 w-4" style={{ color: BRAND_PRIMARY }} />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <AlertTitle 
              className={
                summaryData.difference >= 0 
                  ? `text-${BRAND_PRIMARY}`
                  : 'text-amber-800'
              }
              style={{ color: summaryData.difference >= 0 ? BRAND_PRIMARY : undefined }}
            >
              {summaryData.comparison}
            </AlertTitle>
            <AlertDescription className="text-gray-800 font-medium">
              Your CV's ATS compatibility has {summaryData.difference >= 0 ? 'improved' : 'decreased'} by {Math.abs(summaryData.difference || 0)}%.
            </AlertDescription>
          </Alert>
        </div>

        {/* Recommendations with brand styling */}
        {showDetails && summaryData.recommendedActions && summaryData.recommendedActions.length > 0 && (
          <div className="mt-6 p-4 rounded-lg bg-muted/30">
            <h3 className="text-lg font-semibold mb-3 flex items-center" style={{ color: BRAND_PRIMARY }}>
              <BarChart className="w-5 h-5 mr-2" style={{ color: BRAND_PRIMARY }} />
              Recommended Actions
            </h3>
            <ul className="space-y-2 list-none">
              {summaryData.recommendedActions.map((action: string, index: number) => (
                <li key={index} className="text-sm flex items-start">
                  <div className="flex-shrink-0 mt-1 mr-2 text-primary">
                    <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                  </div>
                  <div>{action}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end border-t border-border/40 pt-4">
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="text-xs hover:bg-primary/10 hover:text-primary"
          style={{ borderColor: BRAND_PRIMARY_LIGHT, color: BRAND_PRIMARY }}
        >
          Refresh Results
        </Button>
      </CardFooter>
    </Card>
  );
} 