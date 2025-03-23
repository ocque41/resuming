import { Suspense } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmailStatsContent from './email-stats-content';

export const metadata = {
  title: 'Email Statistics | Admin',
};

export default async function EmailStatsPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Delivery Statistics</h1>
        <p className="text-muted-foreground">
          Monitor email sending and delivery performance
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Sending Overview</CardTitle>
            <CardDescription>
              Summary of all emails sent through the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<EmailStatsSkeleton />}>
              <EmailStatsContent />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmailStatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border rounded-lg">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      
      <Skeleton className="h-[300px] w-full" />
      
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-3 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 