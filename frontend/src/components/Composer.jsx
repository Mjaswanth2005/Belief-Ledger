import { useState } from "react";

const EXAMPLES = [
  "I think remote work hurts junior devs because they miss osmotic learning that happens in offices.",
  "Most startup advice is survivorship bias. The reason a thing worked for one founder rarely generalizes.",
  "I'm pretty sure LLMs will plateau on reasoning benchmarks within 18 months without a real architectural shift.",
];

export default function Composer({ onSubmit, submitting }) {
  const [text, setText] = useState("");

  const submit = async () => {
    const t = text.trim();
    if (t.length < 5 || submitting) return;
    const result = await onSubmit(t);
    if (result) setText("");
  };

  return (
    <div className="flex flex-col gap-4" data-testid="composer">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs tracking-[0.25em] uppercase text-amber-glow">
          &gt; WRITE_ENTRY
        </h2>
        <span className="text-[10px] text-ink-secondary">
          {text.length} chars
        </span>
      </div>

      <p className="text-xs text-ink-secondary leading-relaxed">
        Write naturally about anything you believe. The extractor will parse out
        claims, confidence levels, and assumptions, then check them against your
        existing ledger.
      </p>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="// e.g. I think compound interest is the single most underrated force in personal finance because people don't internalize exponential curves..."
          className="w-full min-h-[260px] bg-void border border-edge text-ink-primary p-4 text-sm font-mono leading-relaxed rounded-none resize-none focus:outline-none focus:border-amber-glow focus:ring-1 focus:ring-amber-glow transition-colors placeholder:text-ink-secondary/50"
          data-testid="entry-textarea"
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-ink-secondary/60 uppercase tracking-widest">
          ⌘/Ctrl + Enter to commit
        </span>
        <button
          onClick={submit}
          disabled={submitting || text.trim().length < 5}
          className="bg-amber-glow text-void font-bold uppercase tracking-[0.2em] text-xs px-5 py-2.5 border border-amber-glow hover:bg-amber-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          data-testid="commit-entry-btn"
        >
          {submitting ? (
            <span>
              extracting<span className="animate-blink">█</span>
            </span>
          ) : (
            <span>[ commit ]</span>
          )}
        </button>
      </div>

      <div className="mt-4 border-t border-edge pt-4">
        <div className="text-[10px] text-ink-secondary uppercase tracking-[0.25em] mb-3">
          &gt; quickstart_examples
        </div>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              disabled={submitting}
              className="text-left text-xs text-ink-secondary border border-edge p-2.5 hover:border-amber-glow hover:text-ink-primary transition-colors leading-relaxed"
              data-testid={`example-${i}`}
            >
              <span className="text-amber-glow mr-2">·</span>{ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
