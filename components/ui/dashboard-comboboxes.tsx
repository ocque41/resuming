"use client"

import * as React from "react";
import { ComboboxPopover } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";

export function DashboardComboboxes({ cvs }: { cvs: string[] }) {
  return (
    <div className="flex flex-col lg:flex-row justify-between mt-4 mx-auto max-w-md lg:max-w-2xl">
      <ComboboxPopover
        label="Analyze"
        options={cvs}
        onSelect={(cv: string) => console.log(`Analyze ${cv}`)}
      />
      <ComboboxPopover
        label="Optimize"
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
