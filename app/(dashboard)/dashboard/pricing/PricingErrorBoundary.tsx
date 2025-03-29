"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Props {
  children: ReactNode;
}


interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class PricingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('PricingErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-900/30 bg-[#1A0A0A] p-6 text-[#F9F6EE] my-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <div className="space-y-2">
              <h3 className="font-medium text-[#F9F6EE] font-safiro text-xl">
                Pricing Component Error
              </h3>
              <div className="text-sm text-[#C5C2BA] font-borna">
                <p className="mb-2">
                  We encountered an error loading the pricing plans. This might be a temporary issue.
                </p>
                <p className="text-xs opacity-75 mb-4">
                  Error: {this.state.error?.message || 'Unknown error'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
                <Button 
                  className="bg-[#111111] hover:bg-[#1A1A1A] text-[#F9F6EE] font-borna border border-[#222222] hover:border-[#333333] transition-colors"
                  onClick={this.handleReload}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Link href="/dashboard">
                  <Button
                    className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] font-safiro transition-colors w-full"
                  >
                    Return to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PricingErrorBoundary; 