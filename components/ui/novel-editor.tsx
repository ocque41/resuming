'use client';

import { Editor } from 'novel';

interface NovelEditorProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function NovelEditor({
  defaultValue = '',
  onChange,
  placeholder = 'Start writing...',
  className,
}: NovelEditorProps) {
  return (
    <div className={className}>
      <Editor
        defaultValue={defaultValue}
        onUpdate={({ editor }) => {
          const html = editor.getHTML();
          onChange?.(html);
        }}
        className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        disableLocalStorage
      />
    </div>
  );
}
