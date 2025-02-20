"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ComboboxPopover } from "@/components/ui/combobox";

interface AnalyzeCVCardProps {
  cvs: string[];
}

export default function AnalyzeCVCard({ cvs }: AnalyzeCVCardProps) {
  return (
    <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
      <CardContent>
        <div className="flex justify-center items-center h-32 bg-gray-100 rounded-lg mb-4">
          {/* Placeholder for animation */}
          <span className="text-gray-500">Animation Placeholder</span>
        </div>
        <ComboboxPopover
          label="Select a CV"
          options={cvs}
          onSelect={(selectedCV: string) => console.log("Selected CV:", selectedCV)}
        />
      </CardContent>
    </Card>
  );
}
