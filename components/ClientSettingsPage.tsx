"use client";

import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  DollarSign, 
  Users, 
  Activity, 
  Shield, 
  ArrowLeft,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { ArticleTitle } from '@/components/ui/article';
import BillingButton from '@/app/(dashboard)/dashboard/billing-button';
import { InviteTeamMember } from '@/app/(dashboard)/dashboard/invite-team';
import ActivityLogClient from '@/components/ActivityLogClient';
import ErrorBoundaryWrapper from './ErrorBoundaryWrapper';

// Dynamically import pages to prevent server/client component conflicts
import dynamic from 'next/dynamic';

const GeneralPage = dynamic(() => import('@/app/(dashboard)/dashboard/general/page'), {
  ssr: false,
  loading: () => <ComponentLoader label="Loading account information..." />
});

const SecurityPage = dynamic(() => import('@/app/(dashboard)/dashboard/security/page'), {
  ssr: false,
  loading: () => <ComponentLoader label="Loading security settings..." />
});

// Loading component
function ComponentLoader({ label = "Loading component..." }) {
  return (
    <div className="w-full h-40 flex flex-col items-center justify-center p-6 bg-[#0A0A0A] border border-[#222222] rounded-xl">
      <Loader2 className="h-8 w-8 animate-spin text-[#B4916C] mb-3" />
      <span className="text-[#F9F6EE] font-borna">{label}</span>
    </div>
  );
}

// Error fallback component
function ErrorFallback({ message = "Failed to load component" }) {
  return (
    <div className="w-full p-6 bg-[#0A0A0A] border border-red-900/30 rounded-xl flex flex-col items-center justify-center space-y-3">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <div className="text-center">
        <h3 className="text-[#F9F6EE] font-safiro font-medium">Component Error</h3>
        <p className="text-[#C5C2BA] font-borna">{message}</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-[#111111] hover:bg-[#1A1A1A] text-[#F9F6EE] rounded-lg transition-colors font-borna mt-2"
      >
        Reload Page
      </button>
    </div>
  );
}

interface ClientSettingsDialogContentProps {
  teamData: any;
  activityLogs: any[];
  onClose: () => void;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export default function ClientSettingsDialogContent({
  teamData,
  activityLogs,
  onClose,
}: ClientSettingsDialogContentProps) {
  const [activeSection, setActiveSection] = useState('account');

  return (
    <motion.section 
      className="flex-1 p-4 lg:p-8 bg-[#050505] text-[#F9F6EE] min-h-screen rounded-xl overflow-hidden"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="space-y-8 mx-auto max-w-md lg:max-w-3xl">
        <motion.header 
          className="flex items-center justify-between mb-8"
          variants={itemVariants}
        >
          <div className="flex items-center justify-between w-full">
            <ArticleTitle className="text-xl lg:text-3xl font-bold text-[#F9F6EE] font-safiro tracking-tight">
              User <span className="text-[#B4916C]">Settings</span>
            </ArticleTitle>
            <motion.button 
              onClick={onClose} 
              className="flex items-center px-4 py-2 rounded-lg bg-[#111111] border border-[#222222] text-[#F9F6EE] hover:bg-[#161616] hover:border-[#333333] transition-all duration-300 font-borna"
              whileHover={{ scale: 1.05, x: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="mr-2 h-4 w-4 text-[#B4916C]" />
              Close
            </motion.button>
          </div>
        </motion.header>

        <motion.div variants={itemVariants}>
          <div className="flex items-center mb-4">
            <FileText className="h-5 w-5 text-[#B4916C] mr-2" />
            <h2 className="text-lg font-medium text-[#F9F6EE] font-safiro">Account Information</h2>
          </div>
          <ErrorBoundaryWrapper fallback={<ErrorFallback message="Failed to load account settings" />}>
            <Suspense fallback={<ComponentLoader label="Loading account information..." />}>
              <GeneralPage />
            </Suspense>
          </ErrorBoundaryWrapper>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <div className="flex items-center mb-4 mt-8">
            <DollarSign className="h-5 w-5 text-[#B4916C] mr-2" />
            <h2 className="text-lg font-medium text-[#F9F6EE] font-safiro">Subscription</h2>
          </div>
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-[#B4916C] text-lg font-safiro">Manage Your Plan</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center p-6">
                <BillingButton />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <div className="flex items-center mb-4 mt-8">
            <Users className="h-5 w-5 text-[#B4916C] mr-2" />
            <h2 className="text-lg font-medium text-[#F9F6EE] font-safiro">Team Management</h2>
          </div>
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-[#B4916C] text-lg font-safiro">Invite Team Member</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <InviteTeamMember />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <div className="flex items-center mb-4 mt-8">
            <Activity className="h-5 w-5 text-[#B4916C] mr-2" />
            <h2 className="text-lg font-medium text-[#F9F6EE] font-safiro">Activity Log</h2>
          </div>
          <motion.div
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
            className="bg-[#111111] border border-[#222222] rounded-xl overflow-hidden hover:border-[#333333] transition-all duration-300"
          >
            <ActivityLogClient logs={activityLogs} />
          </motion.div>
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <div className="flex items-center mb-4 mt-8">
            <Shield className="h-5 w-5 text-[#B4916C] mr-2" />
            <h2 className="text-lg font-medium text-[#F9F6EE] font-safiro">Security Settings</h2>
          </div>
          <ErrorBoundaryWrapper fallback={<ErrorFallback message="Failed to load security settings" />}>
            <Suspense fallback={<ComponentLoader label="Loading security settings..." />}>
              <SecurityPage />
            </Suspense>
          </ErrorBoundaryWrapper>
        </motion.div>
      </div>
    </motion.section>
  );
}
