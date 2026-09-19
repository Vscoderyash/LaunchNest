import { LayoutTemplate } from "lucide-react";

// FUTURE (spec section 14 / Phase 4): template marketplace.
// The Template model exists in the schema; this page is the placeholder
// entry point so the nav and data model are ready when it's built.
export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <div className="border border-dashed border-neutral-800 rounded-2xl py-16 flex flex-col items-center text-center">
        <LayoutTemplate size={20} className="text-neutral-600 mb-3" />
        <p className="text-neutral-300 font-medium">Template marketplace — coming in Phase 4</p>
        <p className="text-neutral-500 text-sm mt-1 max-w-sm">
          The data model is already in place. Browsing, previewing, and
          one-click template use will land with the editor.
        </p>
      </div>
    </div>
  );
}
