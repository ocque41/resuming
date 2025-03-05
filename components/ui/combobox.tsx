// components/ui/combobox.tsx
"use client";

import { Combobox, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";

export interface ComboboxPopoverProps {
  label: string;
  options: string[];
  onSelect: (option: string) => void;
  accentColor?: string;
  darkMode?: boolean;
}

export function ComboboxPopover({
  label,
  options,
  onSelect,
  accentColor = "#6366F1", // Default to indigo if no accent color provided
  darkMode = false,
}: ComboboxPopoverProps) {
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");

  // Filter the list based on the user's query.
  const filteredOptions =
    query === ""
      ? options
      : options.filter((option) =>
          option.toLowerCase().includes(query.toLowerCase())
        );

  // When an option is selected, update state and notify the parent.
  const handleChange = (value: string) => {
    setSelected(value);
    onSelect(value);
  };

  return (
    <div className="w-full">
      <style jsx global>{`
        .accent-bg-active {
          background-color: ${accentColor};
        }
        .accent-text {
          color: ${accentColor};
        }
        .accent-border {
          border-color: ${accentColor}20;
        }
        .accent-shadow {
          box-shadow: 0 0 0 1px ${accentColor}20;
        }
        .accent-icon {
          color: ${accentColor}80;
        }
      `}</style>
      
      <Combobox value={selected} onChange={handleChange}>
        <Combobox.Label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </Combobox.Label>
        <div className="relative mt-1">
          <div className={`relative w-full cursor-default overflow-hidden rounded-lg text-left shadow-sm border accent-border accent-shadow focus-within:ring-1 ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
            <Combobox.Input
              className={`w-full border-none py-2.5 pl-3 pr-10 leading-5 focus:ring-0 ${darkMode ? 'bg-gray-900 text-gray-200 placeholder-gray-500' : 'bg-white text-gray-900 placeholder-gray-400'}`}
              placeholder="Select an option"
              onChange={(e) => setQuery(e.target.value)}
              displayValue={(option: string) => option}
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <svg
                className="h-5 w-5 accent-icon"
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
            // Optional: reset query after closing
            afterLeave={() => setQuery("")}
          >
            <Combobox.Options
              className={`absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-lg
                         ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm ${darkMode ? 'bg-gray-900' : 'bg-white'}`}
            >
              {filteredOptions.length === 0 && query !== "" ? (
                <div className={`relative cursor-default select-none py-2 px-4 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                  Nothing found.
                </div>
              ) : (
                filteredOptions.map((option, idx) => (
                  <Combobox.Option
                    key={idx}
                    value={option}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                        active
                          ? "accent-bg-active text-white"
                          : darkMode ? "text-gray-300" : "text-gray-900"
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
                          {option}
                        </span>
                        {isSelected && (
                          <span
                            className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                              active ? "text-white" : "accent-text"
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
