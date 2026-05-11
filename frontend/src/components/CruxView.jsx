import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Target, RotateCw, ArrowRight, AlertTriangle, Brain } from "lucide-react";

export default function CruxView({ api, onSelect }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCruxes = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${api}/cruxes?limit=5`);
      setItems(r.data?.items || []);
    } catch { toast.error("Couldn't load cruxes"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCruxes(); /* eslint-disable-next-line */ }, []);

  if (loading && items === null) {
    return (
      <div className="p-10 text-center" data-testid="crux-loading">
        <div className="inline-block w-20 h-20 bg-pinky border-2 border-ink rounded-2xl shadow-brutal mb-4 flex items-center justify-center animate-pulse">
          <Brain className="w-10 h-10 text-ink" strokeWidth={2.5} />
        </div>
        <h3 className="font-display text-xl">Thinking about your beliefs…</h3>
        <p className="text-sm text-ink/60 mt-2">Computing what would change your mind.</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="p-10 text-center" data-testid="crux-empty">
        <div className="inline-block w-20 h-20 bg-pinky border-2 border-ink rounded-2xl shadow-brutal mb-4 flex items-center justify-center">
          <Target className="w-10 h-10 text-ink" strokeWidth={2.5} />
        </div>
        <h3 className="font-display text-2xl mb-2">No cruxes yet</h3>
        <p className="text-sm text-ink/60">Add a few beliefs and we'll show you what would change your mind.</p>
      </div>
    );
  }

  return (
    <div className="p-5" data-testid="crux-view">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg">What would change my mind?</h3>
        <button
          onClick={fetchCruxes}
          disabled={loading}
          className="btn-brutal bg-paper px-3 py-2 text-sm gap-2 disabled:opacity-50"
          data-testid="recompute-cruxes-btn"
        >
          <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Thinking…" : "Recompute"}
        </button>
      </div>

      <div className="space-y-5">
        {items.map((b, i) => (
          <div key={b.id} className="bg-cream-soft border-2 border-ink rounded-2xl shadow-brutal overflow-hidden" data-testid={`crux-item-${i}`}>
            {/* Belief header */}
            <button
              onClick={() => onSelect && onSelect(b.id)}
              className="w-full text-left p-4 border-b-2 border-ink hover:bg-mint/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap mb-2 text-xs font-bold">
                <span className="font-mono px-2 py-0.5 bg-paper border-2 border-ink rounded">{b.short_id}</span>
                <span className="px-2 py-0.5 bg-lavender border-2 border-ink rounded">#{b.topic}</span>
                <span className="px-2 py-0.5 bg-butter border-2 border-ink rounded">★ {b.centrality}</span>
                <span className="ml-auto px-2 py-0.5 bg-mint border-2 border-ink rounded-full">{b.confidence}%</span>
              </div>
              <div className="font-display text-base sm:text-lg text-ink leading-snug">{b.statement}</div>
              <div className="mt-3 h-3 bg-cream border-2 border-ink rounded-full overflow-hidden">
                <div className="h-full bg-mint" style={{ width: `${b.confidence}%` }} />
              </div>
            </button>

            {/* Cruxes */}
            <div className="p-4 space-y-3 bg-paper">
              {b.cruxes && b.cruxes.length > 0 ? (
                b.cruxes.map((c, j) => (
                  <div key={j} className="border-2 border-ink rounded-xl p-3 bg-cream">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="shrink-0 w-7 h-7 bg-pinky border-2 border-ink rounded-lg flex items-center justify-center text-xs font-bold">
                        {c.importance}
                      </span>
                      <div className="flex-1 text-sm font-semibold text-ink leading-snug flex items-center gap-1">
                        <ArrowRight className="w-4 h-4 shrink-0" /> {c.assumption}
                      </div>
                    </div>
                    <div className="text-sm text-ink/80 pl-9 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-coral-deep" />
                      <span><span className="font-bold">Falsifier:</span> {c.falsifier}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-ink/50 italic">No cruxes identified for this one.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
