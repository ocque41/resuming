"use client";

// Remove this line as we'll use the correct import path
// declare module '@heroicons/react/outline';

import { useState } from "react";
import { Menu } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash, MoreVertical } from "lucide-react";
import DeleteCVButton from "@/components/DeleteCVButton";

interface ActionsDropdownProps {
  cv: any;
}

const MotionMenuItems = motion(Menu.Items);

export default function ActionsDropdown({ cv }: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const menuItems = [
    {
      label: "Delete",
      icon: Trash,
      onClick: () => {},
      className: "text-red-400",
      customContent: <DeleteCVButton cvId={cv.id} />
    }
  ];

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button as={motion.button}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#B4916C] hover:bg-[#161616] transition-colors duration-200"
        >
          <MoreVertical className="w-4 h-4" />
        </Menu.Button>

        <AnimatePresence>
          {isOpen && (
            <MotionMenuItems
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.2, bounce: 0.25 }}
              className="absolute right-0 mt-2 w-48 origin-top-right bg-[#111111] border border-[#222222] rounded-lg shadow-lg focus:outline-none z-10 py-1"
            >
              {menuItems.map((item) => (
                <Menu.Item key={item.label}>
                  {({ active }) => (
                    <div
                      className={`${
                        active ? "bg-[#161616]" : ""
                      } group flex items-center w-full px-4 py-2 text-sm ${item.className}`}
                    >
                      {item.customContent ? (
                        <div className="flex items-center w-full">
                          <item.icon className="w-4 h-4 mr-3" />
                          {item.customContent}
                        </div>
                      ) : (
                        <button
                          onClick={item.onClick}
                          className="flex items-center w-full"
                        >
                          <item.icon className="w-4 h-4 mr-3" />
                          {item.label}
                        </button>
                      )}
                    </div>
                  )}
                </Menu.Item>
              ))}
            </MotionMenuItems>
          )}
        </AnimatePresence>
      </Menu>
    </>
  );
} 