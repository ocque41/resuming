// components/UserMenu.tsx
"use client";

import { useState, Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { MicroCard } from "@/components/ui/micro-card";
import MyDialog from "@/components/ui/dialogui";
import ClientSettingsDialogContent from "@/components/ClientSettingsPage";
import { motion } from "framer-motion";
import { Settings, LogOut, DollarSign, ChevronDown } from "lucide-react";
import { useManageSubscription } from "@/hooks/use-manage-subscription";

interface UserMenuProps {
  teamData: any;
  activityLogs: any[];
}

export default function UserMenu({ teamData, activityLogs }: UserMenuProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = () => {
    window.location.href = "/";
  };

  const { openCustomerPortal: handleManageSubscription, isLoading: isManagingSubscription } =
    useManageSubscription({ fallbackPath: '/dashboard/pricing' });

  const menuItems = [
    {
      key: "manage-subscription",
      label: isManagingSubscription ? "Redirecting..." : "Manage My Subscription",
      icon: DollarSign,
      onClick: handleManageSubscription,
      disabled: isManagingSubscription,
    },
    {
      key: "settings",
      label: "Settings",
      icon: Settings,
      onClick: () => setIsSettingsOpen(true)
    },
    {
      key: "logout",
      label: "Log Out",
      icon: LogOut,
      onClick: handleLogout
    }
  ];

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button as={Fragment}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <MicroCard variant="custom" className="cursor-pointer bg-[#B4916C] hover:bg-[#B4916C]/90 transition-colors duration-200">
              <span className="flex items-center justify-center h-full w-full rounded-full text-white font-safiro">
                U
              </span>
            </MicroCard>
            <ChevronDown className="h-4 w-4 text-[#8A8782]" />
          </motion.div>
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-150"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-[#111111] border border-[#222222] rounded-lg shadow-lg focus:outline-none z-50 py-1 sm:right-0 max-sm:right-0 max-sm:left-auto">
            {menuItems.map((item) => (
              <Menu.Item key={item.key}>
                {({ active }) => (
                  <motion.button
                    whileHover={item.disabled ? undefined : { x: 4 }}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`${
                      active ? "bg-[#161616]" : ""
                    } flex items-center w-full px-4 py-3 text-sm text-[#F9F6EE] font-borna ${
                      item.disabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <item.icon className="h-4 w-4 mr-3 text-[#B4916C]" />
                    {item.label}
                  </motion.button>
                )}
              </Menu.Item>
            ))}
          </Menu.Items>
        </Transition>
      </Menu>
      <MyDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title=""
        panelClassName="max-w-4xl bg-transparent p-0 border-0 shadow-none"
      >
        <ClientSettingsDialogContent
          teamData={teamData}
          activityLogs={activityLogs}
          onClose={() => setIsSettingsOpen(false)}
        />
      </MyDialog>
    </>
  );
}
