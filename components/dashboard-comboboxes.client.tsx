// components/DashboardComboboxes.client.tsx
"use client";

import { ComboboxPopover } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface DashboardComboboxesProps {
  cvs: string[];
}

export default function DashboardComboboxes({ cvs }: DashboardComboboxesProps) {
  const router = useRouter();

  // Define event handlers inside the client component.
  const handleAnalyze = (cv: string) => {
    console.log(`Analyze ${cv}`);
  };

  const handleOptimize = (cv: string) => {
    router.push(`/cv-optimization?cv=${cv}`);
  };

  return (
    <div className="flex justify-between mt-4">
      <ComboboxPopover
        label="Analyze"
        options={cvs}
        onSelect={handleAnalyze}
      />
      <ComboboxPopover
        label="Optimize"
        options={cvs}
        onSelect={handleOptimize}
      />
      <Button variant="outline" size="sm" asChild>
        <a href="/jobs">Jobs</a>
      </Button>
    </div>
  );
}
