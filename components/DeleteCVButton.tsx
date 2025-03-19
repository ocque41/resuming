"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
      // Use the new API endpoint with a query parameter
      const res = await fetch(`/api/delete-cv?cvId=${cvId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Delete CV error:", errorData);
        throw new Error(errorData.error || "Failed to delete file");
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
    <motion.button
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex items-center w-full text-red-400 hover:text-red-300 transition-colors duration-200 disabled:opacity-50"
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      {isDeleting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Deleting...
        </>
      ) : (
        "Delete"
      )}
    </motion.button>
  );
} 