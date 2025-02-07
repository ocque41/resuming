import { Combobox as HeadlessCombobox } from '@headlessui/react';
import { useState } from 'react';

export function Combobox({ value, onChange, children }) {
  return (
    <HeadlessCombobox value={value} onChange={onChange}>
      {children}
    </HeadlessCombobox>
  );
}

export function ComboboxInput({ displayValue, ...props }) {
  return (
    <HeadlessCombobox.Input
      {...props}
      displayValue={displayValue}
      className="w-full border p-2"
    />
  );
}

export function ComboboxOptions({ children, ...props }) {
  return (
    <HeadlessCombobox.Options {...props} className="absolute z-10 mt-1 w-full bg-white shadow-lg">
      {children}
    </HeadlessCombobox.Options>
  );
}

export function ComboboxOption({ value, children, ...props }) {
  return (
    <HeadlessCombobox.Option value={value} {...props} className="cursor-pointer select-none p-2 hover:bg-gray-100">
      {children}
    </HeadlessCombobox.Option>
  );
}

const people = [
  { id: 1, name: 'Durward Reynolds' },
  { id: 2, name: 'Kenton Towne' },
  { id: 3, name: 'Therese Wunsch' },
  { id: 4, name: 'Benedict Kessler' },
  { id: 5, name: 'Katelyn Rohan' },
]

function Example() {
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string } | null>(people[0])
  const [query, setQuery] = useState('')

  const filteredPeople =
    query === ''
      ? people
      : people.filter((person) => {
          return person.name.toLowerCase().includes(query.toLowerCase())
        })

  return (
    <Combobox value={selectedPerson} onChange={(value) => setSelectedPerson(value)} onClose={() => setQuery('')}>
      <ComboboxInput
        aria-label="Assignee"
        displayValue={(person: { id: number; name: string } | null) => (person ? person.name : '')}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ComboboxOptions anchor="bottom" className="border empty:invisible">
        {filteredPeople.map((person) => (
          <ComboboxOption key={person.id} value={person} className="data-[focus]:bg-blue-100">
            {person.name}
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  )
}
