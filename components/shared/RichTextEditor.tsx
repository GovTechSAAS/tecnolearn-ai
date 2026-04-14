"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const FONT_OPTIONS = [
  "Arial",
  "Verdana",
  "Tahoma",
  "Times New Roman",
  "Georgia",
  "Courier New",
];

const SIZE_OPTIONS = [
  { value: "2", label: "Pequena" },
  { value: "3", label: "Normal" },
  { value: "4", label: "Média" },
  { value: "5", label: "Grande" },
  { value: "6", label: "Extra" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite aqui...",
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  const runCommand = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    onChange(editor.innerHTML);
  };

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          defaultValue="Arial"
          onChange={(e) => runCommand("fontName", e.target.value)}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          defaultValue="3"
          onChange={(e) => runCommand("fontSize", e.target.value)}
        >
          {SIZE_OPTIONS.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>

        <Button type="button" variant="outline" size="sm" onClick={() => runCommand("bold")}>
          B
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand("italic")}>
          I
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand("underline")}>
          U
        </Button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML || "")}
        data-placeholder={placeholder}
        className="min-h-[130px] p-3 text-sm outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
