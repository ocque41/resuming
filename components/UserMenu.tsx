// components/UserMenu.tsx
"use client";

import { useState, Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { useRouter } from "next/navigation";
import { MicroCard } from "@/components/ui/micro-card";
import MyDialog from "@/components/ui/dialogui";
import ClientSettingsDialogContent from "@/components/ClientSettingsDialogContent";
import { customerPortalAction } from "@/lib/payments/actions";

interface UserMenuProps {
  teamData: any;
  activityLogs: any[];
}

export default function UserMenu({ teamData, activityLogs }: UserMenuProps) {
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const handleLogout = () => {
    window.location.href = "/";
  };

  const handleManageSubscription = async () => {
    setIsBillingLoading(true);
    try {
      // Use the same customer portal action as the BillingButton
      await customerPortalAction(new FormData());
    } catch (error) {
      console.error("Error redirecting to billing portal:", error);
    } finally {
      setIsBillingLoading(false);
    }
  };

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button as={Fragment}>
          <MicroCard className="cursor-pointer ml-auto bg-[#584235]">
            <span className="flex items-center justify-center h-full w-full rounded-full text-white text-lg">
              U
            </span>
          </MicroCard>
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-[#050505] text-white divide-y divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleManageSubscription}
                    className={`${active ? "bg-gray-700" : ""} block w-full text-left px-4 py-2 text-sm`}
                    disabled={isBillingLoading}
                  >
                    {isBillingLoading ? "Loading..." : "Manage Subscription"}
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className={`${active ? "bg-gray-700" : ""} block w-full text-left px-4 py-2 text-sm`}
                  >
                    Settings
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleLogout}
                    className={`${active ? "bg-gray-700" : ""} block w-full text-left px-4 py-2 text-sm`}
                  >
                    Log Out
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>
      <MyDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="User Settings"
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
