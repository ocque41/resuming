'use client';

import { Editor as NovelEditor } from 'novel';

interface EditorProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Editor({
  defaultValue = '',
  onChange,
  placeholder = 'Start writing...',
  className,
}: EditorProps) {
  return (
    <div className={className}>
      <NovelEditor
        defaultValue={defaultValue}
        onDebouncedUpdate={(editor: any) => {
          if (editor) {
            const html = editor.getHTML();
            onChange?.(html);
          }
        }}
        className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        disableLocalStorage
      />
    </div>
  );
}
