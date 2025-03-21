'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BarChart2, 
  Upload,
  FileText, 
  Plus,
  Trash2,
  Clock,
  User,
  RefreshCw,
  Settings,
  Mail,
  Activity
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { PremiumFeatureCard } from '@/components/ui/premium-feature-card';
import { PlanRestrictedFeature } from '@/components/ui/plan-restricted-feature';
import { EmptyState } from '@/components/ui/empty-state';

// Dynamically import DocumentUploader to ensure it only loads on client
const DocumentUploader = dynamic(() => import('./DocumentUploader'), {
  ssr: false,
});

// Types
interface CV {
  id: string;
  name: string;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: string;
  userId: string;
}

interface TeamData {
  id: string;
  planName?: string;
  [key: string]: any;
}

interface DashboardClientProps {
  userName: string;
  teamData: TeamData;
  cvs: CV[];
  activityLogs: ActivityLog[];
}

export default function DashboardClient({ 
  userName, 
  teamData, 
  cvs, 
  activityLogs 
}: DashboardClientProps) {
  const router = useRouter();
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  
  // Extract plan name with fallback to "Free"
  const planName = teamData?.planName || "Free";
  
  // Helper to format dates
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };
  
  // Get activity icon based on action
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'updated':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'analyzed':
        return <BarChart2 className="h-4 w-4 text-purple-500" />;
      case 'settings':
        return <Settings className="h-4 w-4 text-gray-500" />;
      case 'email':
        return <Mail className="h-4 w-4 text-amber-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format activity action for display
  const formatAction = (action: string) => {
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  // Handle CV deletion
  const handleDeleteCV = async (id: string) => {
    setIsDeleting(prev => ({ ...prev, [id]: true }));
    
    try {
      // API call would go here
      // await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      
      // For demo purposes, we're just simulating an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh data after delete
      router.refresh();
    } catch (error) {
      console.error('Failed to delete CV:', error);
    } finally {
      setIsDeleting(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-safiro text-[#F9F6EE] mb-4">Welcome back, {userName}!</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Create Feature - Pro Plan */}
          <PlanRestrictedFeature 
            requiredPlan="Basic" 
            currentPlan={planName}
            lockedMessage="Create custom CV templates"
          >
            <PremiumFeatureCard
              title="Create"
              description="Build custom CV templates optimized for ATS systems"
              icon={Plus}
              href="/dashboard/create"
            />
          </PlanRestrictedFeature>
          
          {/* Analyze Feature - Basic Plan */}
          <PlanRestrictedFeature 
            requiredPlan="Basic" 
            currentPlan={planName}
            lockedMessage="Analyze your CV against job descriptions"
          >
            <PremiumFeatureCard
              title="Analyze"
              description="Check your CV against job descriptions for keyword optimization"
              icon={BarChart2}
              href="/dashboard/analyze"
            />
          </PlanRestrictedFeature>
          
          {/* Chat Feature - Pro Plan */}
          <PlanRestrictedFeature 
            requiredPlan="Pro" 
            currentPlan={planName}
            lockedMessage="Get AI assistance with your CV"
          >
            <PremiumFeatureCard
              title="Chat"
              description="Ask our AI assistant for help with your CV and job applications"
              icon={Activity}
              href="/dashboard/chat"
            />
          </PlanRestrictedFeature>
        </div>
      </section>
      
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-safiro text-[#F9F6EE]">Your CVs</h2>
          <Button
            onClick={() => setIsUploaderOpen(true)}
            className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CV
          </Button>
        </div>
        
        {cvs.length === 0 ? (
          <EmptyState
            title="No CVs uploaded yet"
            description="Upload your CV to get started with optimization"
            icon={<FileText className="h-12 w-12 text-[#8A8782]" />}
            action={{
              label: "Upload CV",
              onClick: () => setIsUploaderOpen(true)
            }}
          />
        ) : (
          <div className="bg-[#0D0D0D] border border-[#222222] rounded-lg divide-y divide-[#222222]">
            {cvs.map((cv) => (
              <div key={cv.id} className="flex items-center justify-between p-4">
                <div className="flex items-center">
                  <div className="bg-[#161616] p-2 rounded mr-3">
                    <FileText className="h-5 w-5 text-[#B4916C]" />
                  </div>
                  <div>
                    <p className="font-safiro text-[#F9F6EE]">{cv.name}</p>
                    <p className="text-xs text-[#8A8782]">Uploaded {formatDate(cv.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#333333] text-[#C5C2BA] hover:bg-[#1A1A1A]"
                    onClick={() => router.push(`/dashboard/cvs/${cv.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-900/30 text-red-400 hover:bg-red-900/10 hover:border-red-900/50"
                    onClick={() => handleDeleteCV(cv.id)}
                    disabled={isDeleting[cv.id]}
                  >
                    {isDeleting[cv.id] ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      <section>
        <h2 className="text-xl font-safiro text-[#F9F6EE] mb-4">Recent Activity</h2>
        
        {activityLogs.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="Your actions will be logged here"
            icon={<Clock className="h-12 w-12 text-[#8A8782]" />}
          />
        ) : (
          <div className="bg-[#0D0D0D] border border-[#222222] rounded-lg divide-y divide-[#222222]">
            {activityLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center p-4">
                <div className="bg-[#161616] p-2 rounded mr-3">
                  {getActivityIcon(log.action)}
                </div>
                <div>
                  <p className="text-[#F9F6EE]">
                    <span className="text-[#B4916C]">{formatAction(log.action)}</span>
                    {' '}{log.resource.toLowerCase()}
                    {log.resource === 'CV' && (
                      <Link 
                        href={`/dashboard/cvs/${log.resourceId}`} 
                        className="text-[#9ECDFF] hover:underline ml-1"
                      >
                        View
                      </Link>
                    )}
                  </p>
                  <p className="text-xs text-[#8A8782]">{formatDate(log.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DocumentUploader 
        isOpen={isUploaderOpen} 
        onClose={() => setIsUploaderOpen(false)} 
      />
    </div>
  );
} 