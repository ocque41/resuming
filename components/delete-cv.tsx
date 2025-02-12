// components/DeleteCVButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeleteCVButtonProps {
  cvId: string;
}

export default function DeleteCVButton({ cvId }: DeleteCVButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = confirm("Are you sure you want to delete this file?");
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/cv/${cvId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete file");
      }
      // Refresh the dashboard to update the list of files.
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to delete file");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-600 hover:underline"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
