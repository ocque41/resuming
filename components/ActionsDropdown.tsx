"use client";

// Remove this line as we'll use the correct import path
// declare module '@heroicons/react/outline';

import { useState } from "react";
import { Menu } from "@headlessui/react";
// Update the import path for Heroicons v2
import { ChevronDownIcon, TrashIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import DeleteCVButton from "@/components/delete-cv";

interface ActionsDropdownProps {
  cv: any;
}

export default function ActionsDropdown({ cv }: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleDownload = async () => {
    try {
      // Get the metadata to check if there's an optimized version
      let metadata = null;
      try {
        metadata = cv.metadata ? JSON.parse(cv.metadata) : null;
      } catch (parseError) {
        console.error('Error parsing metadata:', parseError);
        metadata = null;
      }
      
      // Determine which file to download (original or optimized)
      const endpoint = metadata?.optimized 
        ? `/api/download-cv?fileName=${encodeURIComponent(cv.fileName)}&optimized=true` 
        : `/api/download-cv?fileName=${encodeURIComponent(cv.fileName)}`;
      
      // Fetch the file
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = cv.fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-black rounded-md bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
          Actions
          <ChevronDownIcon
            className="w-5 h-5 ml-2 -mr-1 text-violet-200 hover:text-violet-100"
            aria-hidden="true"
          />
        </Menu.Button>
      </div>
      <Menu.Items className="absolute right-0 w-56 mt-2 origin-top-right bg-[#121212] divide-y divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
        <div className="px-1 py-1">
          <Menu.Item>
            {({ active }) => (
              <button
                className={`${
                  active ? 'bg-[#1a1a1a]' : ''
                } group flex rounded-md items-center w-full px-2 py-2 text-sm text-white`}
                onClick={handleDownload}
              >
                <ArrowDownTrayIcon className="w-5 h-5 mr-2" aria-hidden="true" />
                Download
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <div
                className={`${
                  active ? 'bg-[#1a1a1a]' : ''
                } group flex rounded-md items-center w-full px-2 py-2 text-sm text-white`}
              >
                <TrashIcon className="w-5 h-5 mr-2 text-red-500" aria-hidden="true" />
                <DeleteCVButton cvId={cv.id} />
              </div>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  );
} 