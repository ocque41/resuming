"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

interface DocumentComboboxProps {
  documents: Document[];
  onSelect: (documentId: string) => void;
  placeholder?: string;
  className?: string;
  emptyMessage?: string;
}

export default function DocumentCombobox({
  documents = [],
  onSelect,
  placeholder = "Select a document",
  className,
  emptyMessage = "No documents found."
}: DocumentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [sortedDocuments, setSortedDocuments] = useState<Document[]>([]);

  // Sort documents by creation date, newest first
  useEffect(() => {
    const sorted = [...documents].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // newest first
    });
    setSortedDocuments(sorted);
  }, [documents]);

  // Find the selected document name
  const selectedDocumentName = documents.find(doc => doc.id === selectedDocumentId)?.fileName || "";

  // Handle document selection
  const handleSelectDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setOpen(false);
    onSelect(documentId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-black border-gray-700 text-gray-300",
            !selectedDocumentId && "text-gray-500",
            className
          )}
        >
          {selectedDocumentId ? selectedDocumentName : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[250px] p-0 bg-[#121212] border border-gray-700">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search documents..." className="text-gray-300" />
          <CommandEmpty className="py-6 text-center text-gray-500">
            {emptyMessage}
          </CommandEmpty>
          <CommandGroup className="max-h-[200px] overflow-auto">
            {sortedDocuments.map((document) => (
              <CommandItem
                key={document.id}
                value={document.id}
                onSelect={handleSelectDocument}
                className="cursor-pointer text-gray-300 hover:bg-[#1A1A1A] aria-selected:bg-[#B4916C]/20"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedDocumentId === document.id ? "opacity-100 text-[#B4916C]" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{document.fileName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(document.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 