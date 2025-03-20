"use client";

import React, { useState } from 'react';

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
export default function DebugViewer({ data, title = "Debug Data", collapsed = false }: DebugViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  
  if (!data) return null;
  
  return (
    <div className="debug-viewer mt-8 border-t pt-4">
      <details className="text-xs" open={!isCollapsed}>
        <summary 
          className="cursor-pointer font-medium mb-2"
          onClick={(e) => {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }}
        >
          {title}
        </summary>
        <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
} 