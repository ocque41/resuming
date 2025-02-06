"use client"

import * as React from "react";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";

export function DashboardComboboxes({ cvs }: { cvs: string[] }) {
  return (
    <div className="flex justify-between mt-4">
      <ComboboxPopover
        label="Analyze (CV)"
        options={cvs}
        onSelect={(cv: string) => console.log(`Analyze ${cv}`)}
      />
      <ComboboxPopover
        label="Optimize (CV)"
        options={cvs}
        onSelect={(cv: string) =>
          (window.location.href = `/cv-optimization?cv=${cv}`)
        }
      />
      <Button variant="outline" size="sm" asChild>
        <a href="/jobs">Jobs</a>
      </Button>
    </div>
  );
}
