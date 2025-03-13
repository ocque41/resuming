/* use client */
'use client';

import React, { FC } from 'react';

interface SpecificOptimizeCVCardProps {
  cvs: string[];
}

const SpecificOptimizeCVCard: FC<SpecificOptimizeCVCardProps> = ({ cvs }) => {
  return (
    <div className="p-4 bg-gray-800 text-white rounded-md">
      <p>Specific Optimize CV Card - placeholder component.</p>
      <p>Received {cvs.length} CVs.</p>
    </div>
  );
};

export default SpecificOptimizeCVCard; 