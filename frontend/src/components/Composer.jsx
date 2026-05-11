import { useState } from "react";
import { Lightbulb, Send } from "lucide-react";

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
    const r = await onSubmit(t);
    if (r) setText("");
  };

  return (
    <div className="bg-paper border-2 border-ink rounded-2xl shadow-brutal-lg p-5" data-testid="composer">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-display text-xl text-ink">Write a thought</h2>
        <span className="text-xs font-bold text-ink/50">{text.length} chars</span>
      </div>

      <p className="text-sm text-ink/70 mb-4 leading-relaxed">
        Write naturally about anything you believe — opinions, hunches, hot takes. The extractor will pull out the claims, confidence, and assumptions.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I think compound interest is the single most underrated force in personal finance because people don't internalize exponential curves..."
        className="w-full min-h-[200px] bg-cream-soft border-2 border-ink rounded-xl p-4 text-base font-sans leading-relaxed resize-none focus:outline-none focus:ring-4 focus:ring-butter/60 transition-all placeholder:text-ink/40"
        data-testid="entry-textarea"
        disabled={submitting}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
      />

      <div className="flex items-center justify-between gap-3 mt-4">
        <span className="text-xs text-ink/50 font-medium hidden sm:block">
          ⌘ / Ctrl + Enter
        </span>
        <button
          onClick={submit}
          disabled={submitting || text.trim().length < 5}
          className="btn-brutal-lg bg-butter px-5 py-3 text-base gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
          data-testid="commit-entry-btn"
        >
          {submitting ? (
            <>Thinking<span className="inline-block animate-pulse">…</span></>
          ) : (
            <><Send className="w-4 h-4" /> Commit</>
          )}
        </button>
      </div>

      <div className="mt-5 pt-4 border-t-2 border-ink/10">
        <div className="flex items-center gap-2 text-sm font-bold text-ink/70 mb-3">
          <Lightbulb className="w-4 h-4" /> Try one of these
        </div>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              disabled={submitting}
              className="text-left text-sm text-ink bg-cream border-2 border-ink/30 rounded-xl p-3 hover:border-ink hover:bg-lavender hover:shadow-brutal-sm hover:-translate-y-0.5 transition-all"
              data-testid={`example-${i}`}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
