import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Sparkles, Zap } from "lucide-react";

export default function ExtractionResult({ result, api, beliefs, onOpenBelief, onClose }) {
  const [cruxByBelief, setCruxByBelief] = useState({});
  const [computing, setComputing] = useState({});
  const [ripples, setRipples] = useState({});

  const byId = Object.fromEntries((beliefs || []).map(b => [b.id, b]));

  const contradictions = [];
  (result?.results || []).forEach(r => {
    (r.relationships || []).forEach(rel => {
      if (rel.relation === "contradiction") {
        const existing = byId[rel.id];
        if (existing) contradictions.push({ existing, newBelief: r.belief, reason: rel.reason });
      }
    });
  });

  useEffect(() => {
    const ids = new Set();
    contradictions.forEach(c => { ids.add(c.existing.id); ids.add(c.newBelief.id); });
    ids.forEach(id => {
      if (ripples[id]) return;
      axios.get(`${api}/beliefs/${id}/ripple`).then(r => {
        setRipples(prev => ({ ...prev, [id]: r.data?.ripple || [] }));
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const runCrux = async (id) => {
    setComputing(prev => ({ ...prev, [id]: true }));
    try {
      const r = await axios.post(`${api}/beliefs/${id}/crux`);
      setCruxByBelief(prev => ({ ...prev, [id]: r.data?.cruxes || [] }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Crux computation failed");
      setCruxByBelief(prev => ({ ...prev, [id]: [] }));
    } finally {
      setComputing(prev => ({ ...prev, [id]: false }));
    }
  };

  if (!result) return null;
  const results = result.results || [];

  return (
    <div className="mt-5 bg-paper border-2 border-ink rounded-2xl shadow-brutal-lg overflow-hidden animate-pop-in" data-testid="extraction-result">
      <div className="bg-butter border-b-2 border-ink px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <Sparkles className="w-4 h-4" />
          Just captured · {results.length} belief{results.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={onClose}
          className="text-xs font-bold underline underline-offset-2 hover:text-coral-deep"
          data-testid="close-extraction-btn"
        >dismiss</button>
      </div>

      {/* Contradictions FIRST */}
      {contradictions.length > 0 && (
        <div className="border-b-2 border-ink bg-coral/30 p-4" data-testid="contradiction-banner">
          <div className="flex items-center gap-2 font-bold text-base mb-3">
            <AlertTriangle className="w-5 h-5 text-coral-deep" />
            {contradictions.length} contradiction{contradictions.length === 1 ? "" : "s"} found
          </div>
          <div className="space-y-3">
            {contradictions.map((c, i) => (
              <div key={i} className="bg-paper border-2 border-ink rounded-xl p-3">
                <div className="grid sm:grid-cols-2 gap-3 mb-2">
                  <button
                    onClick={() => onOpenBelief(c.existing.id)}
                    className="text-left bg-cream-soft border-2 border-ink rounded-lg p-3 hover:shadow-brutal-sm hover:-translate-y-0.5 transition-all"
                  >
                    <div className="text-[10px] uppercase tracking-wider font-bold text-ink/60 mb-1">previously</div>
                    <div className="text-sm font-medium line-clamp-2 mb-2">{c.existing.statement}</div>
                    <ConfBar value={c.existing.confidence} tone="mint" />
                    <div className="text-xs text-ink/60 mt-1 font-bold">{c.existing.short_id} · {c.existing.confidence}%</div>
                  </button>
                  <button
                    onClick={() => onOpenBelief(c.newBelief.id)}
                    className="text-left bg-coral/20 border-2 border-ink rounded-lg p-3 hover:shadow-brutal-sm hover:-translate-y-0.5 transition-all"
                  >
                    <div className="text-[10px] uppercase tracking-wider font-bold text-coral-deep mb-1">just wrote</div>
                    <div className="text-sm font-medium line-clamp-2 mb-2">{c.newBelief.statement}</div>
                    <ConfBar value={c.newBelief.confidence} tone="coral" />
                    <div className="text-xs text-ink/60 mt-1 font-bold">{c.newBelief.short_id} · {c.newBelief.confidence}%</div>
                  </button>
                </div>
                <div className="text-xs text-ink/70 italic">{c.reason}</div>
                <Ripple ripples={ripples} ids={[c.existing.id, c.newBelief.id]} onOpenBelief={onOpenBelief} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted beliefs */}
      <div className="p-4 space-y-3">
        {results.map((r, i) => {
          const b = r.belief;
          const cruxes = cruxByBelief[b.id];
          return (
            <div key={b.id} className="bg-cream-soft border-2 border-ink rounded-xl p-3" data-testid={`extracted-${i}`}>
              <div className="flex items-center gap-2 flex-wrap mb-2 text-xs font-bold">
                <span className="font-mono px-2 py-0.5 bg-paper border border-ink rounded">{b.short_id}</span>
                <span className="px-2 py-0.5 bg-lavender border border-ink rounded">#{b.topic}</span>
                <span className="px-2 py-0.5 bg-sky border border-ink rounded">{r.action}</span>
                <span className="ml-auto px-2 py-0.5 bg-mint border-2 border-ink rounded-full">{b.confidence}%</span>
              </div>
              <button
                onClick={() => onOpenBelief(b.id)}
                className="text-left w-full text-base font-medium hover:underline mb-2"
              >{b.statement}</button>
              <ConfBar value={b.confidence} tone="butter" />

              {b.assumptions && b.assumptions.length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="font-bold text-ink/70 mb-1">Implicit assumptions:</div>
                  {b.assumptions.map((a, j) => (
                    <div key={j} className="pl-3 border-l-2 border-ink/30 mb-0.5 text-ink/80">{a}</div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                {!cruxes && (
                  <button
                    onClick={() => runCrux(b.id)}
                    disabled={computing[b.id]}
                    className="btn-brutal bg-pinky px-3 py-2 text-sm gap-2 disabled:opacity-50"
                    data-testid={`compute-crux-inline-${i}`}
                  >
                    <Zap className="w-4 h-4" />
                    {computing[b.id] ? "Thinking…" : "What would change my mind?"}
                  </button>
                )}
                {cruxes && (
                  <div className="space-y-2 mt-2">
                    {cruxes.length === 0 ? (
                      <div className="text-xs text-ink/60 italic">No cruxes identified.</div>
                    ) : cruxes.map((c, j) => (
                      <div key={j} className="bg-paper border-2 border-ink rounded-lg p-2.5 text-xs">
                        <div className="font-semibold mb-1 flex items-center gap-1.5">
                          <span className="inline-flex w-5 h-5 bg-pinky border border-ink rounded items-center justify-center text-[10px]">{c.importance}</span>
                          <ArrowRight className="w-3 h-3" />
                          {c.assumption}
                        </div>
                        <div className="text-ink/80 pl-7"><span className="font-bold text-coral-deep">Falsifier:</span> {c.falsifier}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfBar({ value, tone = "mint" }) {
  const fill = tone === "coral" ? "bg-coral-deep" : tone === "butter" ? "bg-butter" : "bg-mint";
  return (
    <div className="h-2.5 bg-cream border-2 border-ink rounded-full overflow-hidden">
      <div className={`h-full ${fill}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function Ripple({ ripples, ids, onOpenBelief }) {
  const [expanded, setExpanded] = useState(false);
  const merged = [];
  const seen = new Set();
  ids.forEach(id => {
    (ripples[id] || []).forEach(r => {
      if (!seen.has(r.id) && !ids.includes(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
    });
  });
  if (merged.length === 0) return null;
  const visible = expanded ? merged : merged.slice(0, 3);
  return (
    <div className="mt-3 pt-3 border-t-2 border-ink/10" data-testid="ripple-panel">
      <div className="text-xs font-bold text-coral-deep mb-2">
        Ripple · {merged.length} downstream belief{merged.length === 1 ? "" : "s"} affected
      </div>
      <div className="space-y-1">
        {visible.map(r => (
          <button
            key={r.id}
            onClick={() => onOpenBelief(r.id)}
            className="block w-full text-left text-xs text-ink/80 hover:text-ink hover:underline truncate"
            data-testid={`ripple-${r.short_id}`}
          >
            <span className="font-mono font-bold mr-2">{r.short_id}</span>
            <span className="font-bold mr-2">{r.confidence}%</span>
            {r.statement}
          </button>
        ))}
      </div>
      {merged.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-bold underline underline-offset-2 hover:text-coral-deep"
        >
          {expanded ? "collapse" : `show ${merged.length - 3} more`}
        </button>
      )}
    </div>
  );
}
