// components/SecuritySettingsClient.tsx
"use client";

interface SecuritySettingsClientProps {
  data: any;
}

export default function SecuritySettingsClient({ data }: SecuritySettingsClientProps) {
  return (
    <section>
      <h2 className="text-lg font-medium">Security Settings</h2>
      <div>
        {/* Render your security settings data here */}
        {JSON.stringify(data)}
      </div>
    </section>
  );
}
