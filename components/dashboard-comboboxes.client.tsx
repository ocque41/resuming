// components/dashboard-comboboxes.client.tsx
"use client";

import { Combobox, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";

// Define a type for your CV record.
// Make metadata optional so that records without it are still assignable.
export interface CV {
  id: number;
  userId: number;
  fileName: string;
  filePath: string;
  createdAt: Date;
  metadata?: string | null;
}

export interface DashboardComboboxesProps {
  cvs: CV[];
  onSelect?: (cv: CV) => void;
}

export default function DashboardComboboxes({ cvs, onSelect }: DashboardComboboxesProps) {
  const [selected, setSelected] = useState<CV | null>(null);
  const [query, setQuery] = useState("");

  const filteredOptions =
    query === ""
      ? cvs
      : cvs.filter((cv) =>
          cv.fileName.toLowerCase().includes(query.toLowerCase())
        );

  const handleChange = (cv: CV) => {
    setSelected(cv);
    if (onSelect) {
      onSelect(cv);
    }
  };

  return (
    <div className="w-64">
      <Combobox value={selected} onChange={handleChange}>
        <Combobox.Label className="block text-sm font-medium text-gray-700">
          Select a CV
        </Combobox.Label>
        <div className="relative mt-1">
          <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md sm:text-sm">
            <Combobox.Input
              className="w-full border-none py-2 pl-3 pr-10 leading-5 text-gray-900 focus:ring-0"
              placeholder="Select a CV"
              onChange={(e) => setQuery(e.target.value)}
              displayValue={(cv: CV) => (cv ? cv.fileName : "")}
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery("")}
          >
            <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {filteredOptions.length === 0 && query !== "" ? (
                <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                  Nothing found.
                </div>
              ) : (
                filteredOptions.map((cv) => (
                  <Combobox.Option
                    key={cv.id}
                    value={cv}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                        active ? "bg-indigo-600 text-white" : "text-gray-900"
                      }`
                    }
                  >
                    {({ selected: isSelected, active }) => (
                      <>
                        <span
                          className={`block truncate ${
                            isSelected ? "font-medium" : "font-normal"
                          }`}
                        >
                          {cv.fileName}
                        </span>
                        {isSelected && (
                          <span
                            className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                              active ? "text-white" : "text-indigo-600"
                            }`}
                          >
                            <svg
                              className="h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 5.293a1 1 0 00-1.414 0L9 11.586 5.707 8.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l7-7a1 1 0 000-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </>
                    )}
                  </Combobox.Option>
                ))
              )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  );
}
