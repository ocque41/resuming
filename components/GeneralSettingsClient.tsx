// components/GeneralSettingsClient.tsx
"use client";

interface GeneralSettingsClientProps {
  data: any;
}

export default function GeneralSettingsClient({ data }: GeneralSettingsClientProps) {
  return (
    <section>
      <h2 className="text-lg font-medium">General Settings</h2>
      <div>
        {/* Render your general settings data here */}
        {JSON.stringify(data)}
      </div>
    </section>
  );
}
