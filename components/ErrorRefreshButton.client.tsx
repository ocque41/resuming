"use client";

import { Button } from '@/components/ui/button';

export default function ErrorRefreshButton() {
  return (
    <Button 
      onClick={() => window.location.reload()}
      className="w-full md:w-auto bg-[#B4916C] hover:bg-[#A3815C] text-white"
    >
      Refresh Page
    </Button>
  );
} 