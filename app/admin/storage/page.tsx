import { Metadata } from "next";
import StorageMigration from "@/app/components/admin/StorageMigration";

export const metadata: Metadata = {
  title: "Admin: Storage Management",
  description: "Manage and migrate file storage",
};

export default async function AdminStoragePage() {
  return (
    <div className="container py-8">
      <StorageMigration />
    </div>
  );
} 