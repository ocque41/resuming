'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/app/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';

// Define types for storage stats and migration results
interface StorageStats {
  totalCVs: number;
  inDropbox: number;
  inS3: number;
  other: number;
}

interface MigrationResult {
  success: boolean;
  message: string;
  cvId: number;
  filePath?: string;
  newFilePath?: string;
}

interface BatchStats {
  total: number;
  succeeded: number;
  failed: number;
}

export default function StorageMigration() {
  // State variables
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [singleCvId, setSingleCvId] = useState('');
  const [batchLimit, setBatchLimit] = useState('10');
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [progress, setProgress] = useState(0);

  // Fetch storage stats on component mount
  useEffect(() => {
    fetchStorageStats();
  }, []);

  // Fetch storage stats from API
  const fetchStorageStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/migrate-storage?action=stats');
      
      if (!response.ok) {
        throw new Error(`Error fetching storage stats: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.stats) {
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to fetch storage stats');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if a CV is in Dropbox
  const checkCVStorage = async () => {
    if (!singleCvId) {
      toast({
        title: 'Error',
        description: 'Please enter a CV ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/migrate-storage?action=check&cvId=${singleCvId}`);
      
      if (!response.ok) {
        throw new Error(`Error checking CV: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'CV Storage Check',
          description: data.isInDropbox 
            ? `CV ${singleCvId} is stored in Dropbox` 
            : `CV ${singleCvId} is not stored in Dropbox`,
        });
      } else {
        throw new Error(data.error || 'Failed to check CV storage');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Migrate a single CV
  const migrateSingleCV = async () => {
    if (!singleCvId) {
      toast({
        title: 'Error',
        description: 'Please enter a CV ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/migrate-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'migrate-file',
          cvId: parseInt(singleCvId),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error migrating CV: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `CV ${singleCvId} was migrated successfully`,
        });
        // Refresh stats
        fetchStorageStats();
      } else {
        throw new Error(data.result?.message || data.error || 'Failed to migrate CV');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Migrate multiple CVs
  const migrateBatch = async () => {
    const limit = parseInt(batchLimit);
    
    if (isNaN(limit) || limit <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid batch limit',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setProgress(0);
      setMigrationResults([]);
      setBatchStats(null);
      
      const response = await fetch('/api/admin/migrate-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'migrate-all',
          limit,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error migrating batch: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setMigrationResults(data.results || []);
        setBatchStats(data.stats || null);
        
        toast({
          title: 'Batch Migration Complete',
          description: `Migrated ${data.stats?.succeeded || 0} files successfully, ${data.stats?.failed || 0} failed`,
        });
        
        // Refresh stats
        fetchStorageStats();
      } else {
        throw new Error(data.error || 'Failed to migrate batch');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setProgress(100); // Complete the progress bar
    }
  };

  // Calculate completion percentage
  const getCompletionPercentage = () => {
    if (!stats) return 0;
    const total = stats.totalCVs;
    if (total === 0) return 0;
    return Math.round((stats.inS3 / total) * 100);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Storage Migration Dashboard</h1>
      
      {/* Storage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Statistics</CardTitle>
          <CardDescription>Current distribution of files across storage systems</CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Total CVs</h3>
                  <p className="text-2xl font-bold">{stats.totalCVs}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Migration Progress</h3>
                  <p className="text-2xl font-bold">{getCompletionPercentage()}%</p>
                </div>
              </div>
              
              <Progress value={getCompletionPercentage()} className="h-2" />
              
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div>
                  <h3 className="text-sm font-medium">In Dropbox</h3>
                  <p className="text-xl font-bold">{stats.inDropbox}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">In S3</h3>
                  <p className="text-xl font-bold">{stats.inS3}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Other Storage</h3>
                  <p className="text-xl font-bold">{stats.other}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                {loading ? 'Loading statistics...' : 'No statistics available'}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={fetchStorageStats} 
            disabled={loading} 
            variant="outline"
            className="w-full"
          >
            Refresh Statistics
          </Button>
        </CardFooter>
      </Card>
      
      {/* Single CV Migration */}
      <Card>
        <CardHeader>
          <CardTitle>Migrate Single CV</CardTitle>
          <CardDescription>Migrate a specific CV from Dropbox to S3</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cvId" className="text-right">
                CV ID
              </Label>
              <Input
                id="cvId"
                className="col-span-3"
                value={singleCvId}
                onChange={(e) => setSingleCvId(e.target.value)}
                placeholder="Enter CV ID"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            onClick={checkCVStorage} 
            variant="outline" 
            disabled={loading || !singleCvId}
          >
            Check Storage
          </Button>
          <Button 
            onClick={migrateSingleCV} 
            disabled={loading || !singleCvId}
          >
            Migrate CV
          </Button>
        </CardFooter>
      </Card>
      
      {/* Batch Migration */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Migration</CardTitle>
          <CardDescription>Migrate multiple CVs from Dropbox to S3</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="batchLimit" className="text-right">
                Batch Limit
              </Label>
              <Input
                id="batchLimit"
                className="col-span-3"
                value={batchLimit}
                onChange={(e) => setBatchLimit(e.target.value)}
                placeholder="Enter number of CVs to migrate"
              />
            </div>
            
            {loading && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Migration in progress...</p>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            
            {batchStats && (
              <div className="bg-muted p-4 rounded-md">
                <h3 className="font-medium mb-2">Batch Results</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-bold">{batchStats.total}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Succeeded</p>
                    <p className="font-bold text-green-600">{batchStats.succeeded}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="font-bold text-red-600">{batchStats.failed}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={migrateBatch} 
            disabled={loading} 
            className="w-full"
          >
            Start Batch Migration
          </Button>
        </CardFooter>
      </Card>
      
      {/* Results Log */}
      {migrationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Results</CardTitle>
            <CardDescription>Log of the most recent migration operation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto border rounded-md">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">CV ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {migrationResults.map((result, index) => (
                    <tr key={index} className={result.success ? "" : "bg-red-50"}>
                      <td className="px-4 py-2 text-sm">{result.cvId}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {result.success ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm truncate max-w-[300px]">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 