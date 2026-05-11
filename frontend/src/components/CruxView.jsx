import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

export default function CruxView({ api, onSelect }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCruxes = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${api}/cruxes?limit=5`);
      setItems(r.data?.items || []);
    } catch (e) {
      toast.error("crux fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCruxes(); /* eslint-disable-next-line */ }, []);

  if (loading && items === null) {
    return (
      <div className="p-6 text-amber-glow text-sm" data-testid="crux-loading">
        computing cruxes for your top beliefs<span className="animate-blink">█</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-ink-secondary text-sm" data-testid="crux-empty">
        <pre className="inline-block text-left text-amber-glow/60 text-xs leading-snug mb-4">
{`     ┌───────────────────────────┐
     │   NO CRUXES YET           │
     │   Add beliefs to compute. │
     └───────────────────────────┘`}
        </pre>
        <div>Write some entries — cruxes appear for your most load-bearing beliefs.</div>
      </div>
    );
  }

  return (
    <div className="p-5" data-testid="crux-view">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-ink-secondary uppercase tracking-[0.25em]">
          &gt; what_would_change_my_mind · top {items.length} load-bearing beliefs
        </div>
        <button
          onClick={fetchCruxes}
          disabled={loading}
          className="text-[10px] uppercase tracking-widest border border-edge text-ink-secondary hover:border-amber-glow hover:text-amber-glow px-2 py-1"
          data-testid="recompute-cruxes-btn"
        >
          {loading ? "recomputing…" : "[recompute]"}
        </button>
      </div>

      <div className="space-y-5">
        {items.map((b, i) => (
          <div key={b.id} className="border border-edge" data-testid={`crux-item-${i}`}>
            <button
              onClick={() => onSelect && onSelect(b.id)}
              className="w-full text-left p-4 border-b border-edge hover:bg-void-surface transition-colors"
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-2 text-ink-secondary">
                <span><span className="text-amber-glow">{b.short_id}</span> · #{b.topic}</span>
                <span>★ {b.centrality} · {b.confidence}%</span>
              </div>
              <div className="text-sm text-ink-primary leading-relaxed">{b.statement}</div>
              <div className="mt-3 h-1 bg-edge relative">
                <div className="absolute inset-y-0 left-0 bg-amber-glow" style={{ width: `${b.confidence}%` }} />
              </div>
            </button>

            <div className="p-4 space-y-3 bg-void">
              {b.cruxes && b.cruxes.length > 0 ? (
                b.cruxes.map((c, j) => (
                  <div key={j} className="border-l-2 border-amber-glow/60 pl-3">
                    <div className="text-xs text-ink-primary mb-1">
                      <span className="text-amber-glow font-bold">→ assumption [{c.importance}/10]</span>{" "}
                      {c.assumption}
                    </div>
                    <div className="text-xs text-ink-secondary">
                      <span className="text-conflict font-bold">! falsifier:</span> {c.falsifier}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-ink-secondary">No cruxes computed yet.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
