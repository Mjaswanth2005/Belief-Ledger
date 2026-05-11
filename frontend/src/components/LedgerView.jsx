const KIND_GLYPH = {
  created: { glyph: "+", color: "text-aligned" },
  confidence_shift: { glyph: "~", color: "text-amber-glow" },
  evidence_added: { glyph: "&", color: "text-ink-primary" },
  dependency_added: { glyph: "→", color: "text-ink-primary" },
  contradiction: { glyph: "!", color: "text-conflict" },
  merge: { glyph: "⊕", color: "text-amber-glow" },
};

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch { return iso; }
}

export default function LedgerView({ revisions, beliefs, onSelect, onSeed, seeding }) {
  if (!revisions || revisions.length === 0) {
    return (
      <div className="p-8 text-center text-ink-secondary text-sm" data-testid="ledger-empty">
        <pre className="inline-block text-left text-amber-glow/60 text-xs leading-snug mb-4">
{`     ┌─────────────────────┐
     │   EMPTY LEDGER      │
     │   No commits yet.   │
     └─────────────────────┘`}
        </pre>
        <div className="mb-4">Write your first entry to start tracking.</div>
        {onSeed && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="border border-amber-glow text-amber-glow px-4 py-2 text-xs uppercase tracking-[0.25em] hover:bg-amber-glow hover:text-void transition-colors disabled:opacity-50"
            data-testid="seed-from-ledger-btn"
          >
            {seeding ? "seeding…" : "[ load demo ledger ]"}
          </button>
        )}
      </div>
    );
  }

  // Group beliefs section
  return (
    <div className="grid lg:grid-cols-[1fr_320px] divide-x divide-edge">
      <div className="p-5" data-testid="ledger-view">
        <div className="text-xs text-ink-secondary uppercase tracking-[0.25em] mb-4">
          &gt; revision_log <span className="text-ink-secondary/50">({revisions.length})</span>
        </div>
        <div className="font-mono text-sm space-y-0">
          {revisions.map((r, idx) => {
            const k = KIND_GLYPH[r.kind] || { glyph: "·", color: "text-ink-secondary" };
            return (
              <div
                key={r.id}
                className="group relative flex gap-3 py-2.5 border-l-2 border-edge pl-4 hover:border-amber-glow hover:bg-void-surface/40 transition-colors cursor-pointer"
                onClick={() => onSelect && onSelect(r.belief_id)}
                data-testid={`revision-${idx}`}
              >
                <span className={`${k.color} font-bold w-4 text-center`}>{k.glyph}</span>
                <span className="text-amber-glow w-20 truncate text-xs">{r.short_id}</span>
                <span className="text-ink-secondary text-xs w-44 truncate hidden md:inline">
                  {fmtTime(r.created_at)}
                </span>
                <span className="flex-1 text-ink-primary text-sm group-hover:text-amber-glow transition-colors">
                  {r.summary}
                </span>
                {r.new_confidence != null && (
                  <span className="text-xs text-ink-secondary hidden sm:inline">
                    {r.prev_confidence != null && `${r.prev_confidence}→`}{r.new_confidence}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="p-5">
        <div className="text-xs text-ink-secondary uppercase tracking-[0.25em] mb-4">
          &gt; beliefs_index <span className="text-ink-secondary/50">({beliefs.length})</span>
        </div>
        <div className="space-y-2">
          {beliefs.length === 0 ? (
            <div className="text-xs text-ink-secondary">No beliefs recorded.</div>
          ) : beliefs.map(b => (
            <button
              key={b.id}
              onClick={() => onSelect && onSelect(b.id)}
              className="w-full text-left border border-edge p-2.5 hover:border-amber-glow transition-colors group"
              data-testid={`belief-card-${b.short_id}`}
            >
              <div className="flex items-center justify-between text-[10px] text-ink-secondary mb-1">
                <span className="text-amber-glow">{b.short_id}</span>
                <span>{b.confidence}%</span>
              </div>
              <div className="text-xs text-ink-primary leading-snug line-clamp-2 group-hover:text-amber-glow transition-colors">
                {b.statement}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-ink-secondary/70">
                <span>#{b.topic}</span>
                {b.centrality > 0 && <span>★ {b.centrality}</span>}
              </div>
              {/* confidence bar */}
              <div className="mt-2 h-1 bg-edge relative">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-glow"
                  style={{ width: `${b.confidence}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
