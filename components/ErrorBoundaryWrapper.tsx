'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-red-900/30 bg-[#1A0A0A] p-6 text-[#F9F6EE]">
          <div className="flex flex-col items-center space-y-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="space-y-2">
              <h3 className="font-medium text-[#F9F6EE] font-safiro text-lg">
                Component Error
              </h3>
              <div className="text-sm text-[#C5C2BA] font-borna">
                <AlertDescription>
                  {this.state.error?.message || 'An unexpected error occurred'}
                </AlertDescription>
              </div>
              <div className="pt-3">
                <Button 
                  className="bg-[#111111] hover:bg-[#1A1A1A] text-[#F9F6EE] font-borna border border-[#222222] hover:border-[#333333] transition-colors"
                  onClick={() => this.setState({ hasError: false, error: null })}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try again
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryWrapper; 