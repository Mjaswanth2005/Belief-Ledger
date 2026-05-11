import { Plus, AlertTriangle, GitMerge, ArrowRight, FileText, Zap } from "lucide-react";

const KIND_META = {
  created: { Icon: Plus, color: "bg-mint", label: "new" },
  confidence_shift: { Icon: Zap, color: "bg-butter", label: "shift" },
  evidence_added: { Icon: FileText, color: "bg-cream-deep", label: "evidence" },
  dependency_added: { Icon: ArrowRight, color: "bg-sky", label: "depends" },
  contradiction: { Icon: AlertTriangle, color: "bg-coral", label: "conflict" },
  merge: { Icon: GitMerge, color: "bg-lavender", label: "merge" },
};

function fmt(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const diff = (today - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch { return iso; }
}

export default function LedgerView({ revisions, beliefs, onSelect, onSeed, seeding }) {
  if (!revisions || revisions.length === 0) {
    return (
      <div className="p-10 text-center" data-testid="ledger-empty">
        <div className="inline-block w-20 h-20 bg-pinky border-2 border-ink rounded-2xl shadow-brutal mb-4 flex items-center justify-center">
          <FileText className="w-10 h-10 text-ink" strokeWidth={2.5} />
        </div>
        <h3 className="font-display text-2xl mb-2">Empty ledger</h3>
        <p className="text-sm text-ink/60 mb-5">Write your first thought, or load demo data to explore.</p>
        {onSeed && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="btn-brutal-lg bg-mint px-5 py-3 text-base"
            data-testid="seed-from-ledger-btn"
          >{seeding ? "Loading…" : "Load demo ledger"}</button>
        )}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] divide-y lg:divide-y-0 lg:divide-x-2 divide-ink/10">
      {/* Revision feed */}
      <div className="p-5" data-testid="ledger-view">
        <h3 className="font-display text-lg mb-4">Revision log <span className="text-ink/40">({revisions.length})</span></h3>
        <div className="space-y-3">
          {revisions.map((r, idx) => {
            const meta = KIND_META[r.kind] || { Icon: Plus, color: "bg-paper", label: r.kind };
            const { Icon } = meta;
            return (
              <button
                key={r.id}
                onClick={() => onSelect && onSelect(r.belief_id)}
                data-testid={`revision-${idx}`}
                className="w-full text-left flex items-start gap-3 p-3 bg-cream-soft border-2 border-ink rounded-xl hover:shadow-brutal hover:-translate-y-0.5 transition-all"
              >
                <div className={`shrink-0 w-10 h-10 ${meta.color} border-2 border-ink rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-ink/60 font-bold mb-1">
                    <span className="font-mono px-2 py-0.5 bg-cream border border-ink/30 rounded">{r.short_id}</span>
                    <span className="uppercase tracking-wider">{meta.label}</span>
                    <span>· {fmt(r.created_at)}</span>
                  </div>
                  <div className="text-sm text-ink leading-snug">{r.summary}</div>
                  {r.new_confidence != null && (
                    <div className="mt-1.5 text-xs text-ink/60 font-bold">
                      {r.prev_confidence != null && `${r.prev_confidence}% → `}{r.new_confidence}% confidence
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Belief index */}
      <aside className="p-5">
        <h3 className="font-display text-lg mb-4">Beliefs <span className="text-ink/40">({beliefs.length})</span></h3>
        <div className="space-y-3">
          {beliefs.length === 0 ? (
            <p className="text-sm text-ink/50">No beliefs yet.</p>
          ) : beliefs.map(b => (
            <button
              key={b.id}
              onClick={() => onSelect && onSelect(b.id)}
              data-testid={`belief-card-${b.short_id}`}
              className="w-full text-left bg-paper border-2 border-ink rounded-xl p-3 hover:shadow-brutal hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="font-mono text-ink/60">{b.short_id}</span>
                <span className="px-2 py-0.5 bg-mint border-2 border-ink rounded-full">{b.confidence}%</span>
              </div>
              <div className="text-sm text-ink leading-snug line-clamp-2 font-medium mb-2">{b.statement}</div>
              <div className="flex items-center justify-between text-xs text-ink/50 mb-2">
                <span>#{b.topic}</span>
                {b.centrality > 0 && <span className="font-bold">★ {b.centrality}</span>}
              </div>
              <ConfBar value={b.confidence} />
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ConfBar({ value }) {
  return (
    <div className="h-3 bg-cream border-2 border-ink rounded-full overflow-hidden">
      <div className="h-full bg-butter border-r-2 border-ink" style={{ width: `${value}%` }} />
    </div>
  );
}
