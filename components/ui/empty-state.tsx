'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: EmptyStateAction;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-12 px-4 bg-[#0D0D0D] border border-[#222222] rounded-lg text-center"
    >
      <div className="mb-4">
        {icon}
      </div>
      
      <h3 className="text-lg font-safiro text-[#F9F6EE] mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-[#8A8782] mb-6 max-w-md">
        {description}
      </p>
      
      {action && (
        <Button
          onClick={action.onClick}
          className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]"
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  );
} 