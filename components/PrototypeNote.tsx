export function PrototypeNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-dashed border-note/40 bg-note-soft px-3 py-2 text-xs leading-relaxed text-note">
      <span aria-hidden className="font-semibold">ⓘ</span>
      <span>
        <span className="font-semibold">Prototype note:</span> {children}
      </span>
    </div>
  );
}
