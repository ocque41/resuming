"use client"

import * as React from "react";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { Button } from "@/components/ui/button";

export function DashboardComboboxes({ cvs, comboboxType }: { cvs: string[], comboboxType?: string }) {
  return (
    <div className="flex flex-col lg:flex-row justify-between mt-4 mx-auto max-w-md lg:max-w-2xl">
      {comboboxType === "analyze" && (
        <Combobox
          value={cvs[0]}
          onChange={(cv: string) => console.log(`Analyze ${cv}`)}
        >
          <ComboboxInput
            aria-label="Analyze"
            displayValue={(cv) => cv as string}
          />
          <ComboboxOptions anchor="bottom" className="border empty:invisible">
            {cvs.map((cv) => (
              <ComboboxOption key={cv} value={cv} className="data-[focus]:bg-blue-100">
                {cv}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </Combobox>
      )}
      {comboboxType === "other" && (
        <Combobox
          value={cvs[0]}
          onChange={(cv: string) =>
            (window.location.href = `/cv-optimization?cv=${cv}`)
          }
        >
          <ComboboxInput
            aria-label="Optimize"
            displayValue={(cv) => cv as string}
          />
          <ComboboxOptions anchor="bottom" className="border empty:invisible">
            {cvs.map((cv) => (
              <ComboboxOption key={cv} value={cv} className="data-[focus]:bg-blue-100">
                {cv}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        </Combobox>
      )}
    </div>
  );
}
