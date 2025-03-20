"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

interface DebugViewerProps {
  data: any;
  title?: string;
  collapsed?: boolean;
}

/**
 * A component for displaying debug information in development environments
 * Usage: <DebugViewer data={someObject} title="API Response" />
 * Only appears when the URL includes debug=true or debug=component_name
 */
export default function DebugViewer({ data, title = "Debug Data", collapsed = true }: DebugViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [isVisible, setIsVisible] = useState(true);

  // Check if we should show debug information
  const showDebug = typeof window !== 'undefined' && (
    window.location.href.includes('debug=true') || 
    window.location.href.includes('debug=')
  );

  if (!showDebug || !isVisible) {
    return null;
  }

  return (
    <Card className="mb-6 border border-amber-500/30 bg-amber-950/10">
      <CardHeader className="py-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-amber-400 flex items-center">
          <span className="bg-amber-900/50 px-2 py-1 mr-2 rounded-md text-xs">DEBUG</span>
          {title}
        </CardTitle>
        <div className="flex">
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 w-6 p-0 hover:bg-amber-900/50"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? '+' : '-'}
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 w-6 p-0 hover:bg-amber-900/50"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="py-2 px-4">
          <div className="text-xs font-mono text-amber-200/80 overflow-auto max-h-96 bg-black/50 p-3 rounded-md">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
} 