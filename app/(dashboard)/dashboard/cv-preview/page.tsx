import { redirect } from "next/navigation";
import { getUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import CVPreviewCard from "@/components/CVPreviewCard.client";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";

export default async function CVPreviewPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <Link href="/dashboard" className="flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">CV Preview & Download</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          View and download your optimized CV in PDF or DOCX format.
        </p>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Optimized CV</CardTitle>
          <CardDescription>
            View your optimized CV with professional formatting. You can download it as a PDF or DOCX file.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <ErrorBoundaryWrapper>
        <CVPreviewCard userId={user.id} />
      </ErrorBoundaryWrapper>
    </div>
  );
} 