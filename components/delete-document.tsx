"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Trash } from "lucide-react";

interface DeleteDocumentProps {
  documentId: number;
}

export default function DeleteDocument({ documentId }: DeleteDocumentProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/document/delete?id=${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      // Redirect to documents page on success
      router.push("/dashboard/documents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsDeleting(false);
    }
  };

  return (
    <div className="mt-4">
      {error && (
        <div className="mb-4 p-2 bg-red-900/20 border border-red-800 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isDeleting}
        className="w-full flex items-center justify-center"
      >
        <Trash className="w-4 h-4 mr-2" />
        {isDeleting ? "Deleting..." : "Delete Document"}
      </Button>
    </div>
  );
} 