import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

/**
 * Inline panel shown after a successful entry commit.
 * - Surfaces contradictions FIRST (the hook).
 * - Lists each newly-extracted belief with confidence + crux button + ripple effects.
 */
export default function ExtractionResult({ result, api, beliefs, onOpenBelief, onClose }) {
  const [cruxByBelief, setCruxByBelief] = useState({});
  const [computing, setComputing] = useState({});
  const [ripples, setRipples] = useState({});

  const byId = Object.fromEntries((beliefs || []).map(b => [b.id, b]));

  // Find contradictions across all results
  const contradictions = [];
  (result?.results || []).forEach(r => {
    (r.relationships || []).forEach(rel => {
      if (rel.relation === "contradiction") {
        const existing = byId[rel.id];
        if (existing) {
          contradictions.push({ existing, newBelief: r.belief, reason: rel.reason });
        }
      }
    });
  });

  // Load ripple effects for each contradicting belief
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

  const runCrux = async (beliefId) => {
    setComputing(prev => ({ ...prev, [beliefId]: true }));
    try {
      const r = await axios.post(`${api}/beliefs/${beliefId}/crux`);
      setCruxByBelief(prev => ({ ...prev, [beliefId]: r.data?.cruxes || [] }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "crux computation failed");
      setCruxByBelief(prev => ({ ...prev, [beliefId]: [] }));
    } finally {
      setComputing(prev => ({ ...prev, [beliefId]: false }));
    }
  };

  if (!result) return null;
  const results = result.results || [];

  return (
    <div className="mt-5 border border-amber-glow shadow-[0_0_24px_rgba(255,176,0,0.12)]" data-testid="extraction-result">
      <div className="border-b border-edge px-4 py-2.5 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.25em] text-amber-glow">
          &gt; just_extracted · {results.length} belief{results.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-ink-secondary hover:text-amber-glow uppercase tracking-widest"
          data-testid="close-extraction-btn"
        >[dismiss]</button>
      </div>

      {/* Contradictions FIRST — the hook */}
      {contradictions.length > 0 && (
        <div className="border-b border-edge bg-conflict/[0.05] p-4" data-testid="contradiction-banner">
          <div className="text-[10px] uppercase tracking-[0.25em] text-conflict mb-3">
            ! {contradictions.length} contradiction{contradictions.length === 1 ? "" : "s"} detected
          </div>
          <div className="space-y-3">
            {contradictions.map((c, i) => (
              <div key={i} className="border border-conflict/40 p-3">
                {/* side-by-side confidence comparison */}
                <div className="grid sm:grid-cols-2 gap-3 mb-2">
                  <div className="text-xs">
                    <div className="text-[10px] uppercase tracking-widest text-ink-secondary mb-1">previously</div>
                    <button
                      onClick={() => onOpenBelief(c.existing.id)}
                      className="text-left text-ink-primary hover:text-amber-glow"
                    >
                      <div className="line-clamp-2">{c.existing.statement}</div>
                      <ConfBar value={c.existing.confidence} />
                      <div className="text-[10px] text-ink-secondary mt-1">{c.existing.short_id} · {c.existing.confidence}%</div>
                    </button>
                  </div>
                  <div className="text-xs sm:border-l sm:border-conflict/30 sm:pl-3">
                    <div className="text-[10px] uppercase tracking-widest text-conflict mb-1">just wrote</div>
                    <button
                      onClick={() => onOpenBelief(c.newBelief.id)}
                      className="text-left text-ink-primary hover:text-amber-glow"
                    >
                      <div className="line-clamp-2">{c.newBelief.statement}</div>
                      <ConfBar value={c.newBelief.confidence} tone="conflict" />
                      <div className="text-[10px] text-ink-secondary mt-1">{c.newBelief.short_id} · {c.newBelief.confidence}%</div>
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-ink-secondary italic">// {c.reason}</div>

                {/* Ripple */}
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
            <div key={b.id} className="border border-edge p-3" data-testid={`extracted-${i}`}>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-2">
                <span className="text-ink-secondary">
                  <span className="text-amber-glow">{b.short_id}</span> · #{b.topic} · {r.action}
                </span>
                <span className="text-amber-glow">{b.confidence}%</span>
              </div>
              <button
                onClick={() => onOpenBelief(b.id)}
                className="text-left w-full text-sm text-ink-primary hover:text-amber-glow leading-snug"
              >
                {b.statement}
              </button>
              <ConfBar value={b.confidence} />

              {b.assumptions && b.assumptions.length > 0 && (
                <div className="mt-3 text-[11px] text-ink-secondary">
                  <div className="uppercase tracking-widest text-[10px] mb-1">implicit assumptions</div>
                  {b.assumptions.map((a, j) => (
                    <div key={j} className="pl-2 border-l border-edge mb-0.5">
                      <span className="text-amber-glow mr-1">·</span>{a}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                {!cruxes && (
                  <button
                    onClick={() => runCrux(b.id)}
                    disabled={computing[b.id]}
                    className="text-[10px] uppercase tracking-widest border border-amber-glow text-amber-glow px-3 py-1.5 hover:bg-amber-glow hover:text-void transition-colors disabled:opacity-50"
                    data-testid={`compute-crux-inline-${i}`}
                  >
                    {computing[b.id] ? "thinking…" : "[ what would change my mind? ]"}
                  </button>
                )}
                {cruxes && (
                  <div className="space-y-2 mt-2">
                    {cruxes.length === 0 ? (
                      <div className="text-xs text-ink-secondary">No cruxes identified.</div>
                    ) : cruxes.map((c, j) => (
                      <div key={j} className="border-l-2 border-amber-glow pl-3 text-xs">
                        <div className="text-ink-primary">
                          <span className="text-amber-glow font-bold">→ [{c.importance}/10]</span> {c.assumption}
                        </div>
                        <div className="text-ink-secondary mt-0.5">
                          <span className="text-conflict">! falsifier:</span> {c.falsifier}
                        </div>
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

function ConfBar({ value, tone = "amber" }) {
  const color = tone === "conflict" ? "bg-conflict" : "bg-amber-glow";
  return (
    <div className="mt-2 h-1 bg-edge relative">
      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function Ripple({ ripples, ids, onOpenBelief }) {
  const [expanded, setExpanded] = useState(false);
  // Merge ripples from both ids, dedupe
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
    <div className="mt-3 border-t border-conflict/20 pt-2" data-testid="ripple-panel">
      <div className="text-[10px] uppercase tracking-widest text-conflict mb-2">
        ripple · {merged.length} downstream belief{merged.length === 1 ? "" : "s"} affected
      </div>
      <div className="space-y-1">
        {visible.map(r => (
          <button
            key={r.id}
            onClick={() => onOpenBelief(r.id)}
            className="block w-full text-left text-xs text-ink-secondary hover:text-amber-glow truncate"
            data-testid={`ripple-${r.short_id}`}
          >
            <span className="text-amber-glow mr-2">{r.short_id}</span>
            <span className="text-ink-secondary mr-2">{r.confidence}%</span>
            {r.statement}
          </button>
        ))}
      </div>
      {merged.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[10px] uppercase tracking-widest text-ink-secondary hover:text-amber-glow"
        >
          {expanded ? "[ collapse ]" : `[ show full cascade (${merged.length - 3} more) ]`}
        </button>
      )}
    </div>
  );
}
