"use client";

import React from "react";
import DashboardComboboxes from "@/components/dashboard-comboboxes.client";
import DragAndDropUpload from "@/components/ui/drag&drop";

// Expecting cvs to be passed as props
export default function DashboardClientWrapper({ cvs }: { cvs: any[] }) {
  return (
    <>
      <div className="bg-black text-white p-6 rounded-lg mt-8 mx-auto max-w-md lg:max-w-2xl h-192 flex items-center justify-center">
        <DragAndDropUpload />
      </div>
      <DashboardComboboxes cvs={cvs} />
    </>
  );
}
