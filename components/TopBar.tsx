"use client";

type Props = {
  learnOn: boolean;
  onToggleLearn: () => void;
  dueCount: number;
  simulated: boolean;
};

export function TopBar({ learnOn, onToggleLearn, dueCount, simulated }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold">Claude</span>
        <span className="text-muted">· acme-notes</span>
        {simulated && (
          <span className="rounded-full bg-note-soft px-2 py-0.5 text-[11px] font-medium text-note">
            Mock mode: no API key
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLearn}
          role="switch"
          aria-checked={learnOn}
          className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm hover:border-learn/50"
        >
          <span aria-hidden>🎓</span>
          <span className={learnOn ? "font-medium text-learn" : ""}>Learn mode</span>
          <span className={`relative h-4 w-7 rounded-full transition ${learnOn ? "bg-learn" : "bg-border"}`}>
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${learnOn ? "left-3.5" : "left-0.5"}`}
            />
          </span>
        </button>
        <button
          aria-label={`${dueCount} learning refreshers due`}
          className="relative rounded-full p-1.5 text-lg leading-none hover:bg-bg"
        >
          🔔
          {dueCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">
              {dueCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
