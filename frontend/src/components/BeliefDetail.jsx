import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";

export default function BeliefDetail({ beliefId, api, onClose, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [computingCrux, setComputingCrux] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get(`${api}/beliefs/${beliefId}`)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => toast.error("belief load failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [beliefId, api]);

  const runCrux = async () => {
    setComputingCrux(true);
    try {
      const r = await axios.post(`${api}/beliefs/${beliefId}/crux`);
      setData(prev => ({ ...prev, belief: { ...prev.belief, cruxes: r.data.cruxes } }));
      toast.success(`identified ${r.data.cruxes.length} crux(es)`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "crux failed");
    } finally {
      setComputingCrux(false);
    }
  };

  const b = data?.belief;

  return (
    <div
      className="fixed inset-0 bg-void/85 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
      data-testid="belief-detail-overlay"
    >
      <div
        className="w-full max-w-3xl bg-void border border-amber-glow shadow-[0_0_30px_rgba(255,176,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-edge px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-amber-glow font-bold tracking-widest">[ BELIEF ]</span>
            <span className="text-ink-secondary">{b?.short_id || "…"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete && onDelete(beliefId)}
              className="text-xs text-ink-secondary hover:text-conflict border border-edge hover:border-conflict px-2 py-1 transition-colors"
              data-testid="delete-belief-btn"
            >[delete]</button>
            <button
              onClick={onClose}
              className="text-xs text-ink-secondary hover:text-amber-glow border border-edge hover:border-amber-glow px-2 py-1 transition-colors"
              data-testid="close-belief-btn"
            >[esc · close]</button>
          </div>
        </div>

        {loading || !b ? (
          <div className="p-8 text-amber-glow text-sm">loading<span className="animate-blink">█</span></div>
        ) : (
          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Statement */}
            <div>
              <div className="text-[10px] text-ink-secondary uppercase tracking-[0.25em] mb-2">&gt; statement</div>
              <div className="text-base text-ink-primary leading-relaxed">{b.statement}</div>
            </div>

            {/* Confidence bar */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-ink-secondary uppercase tracking-[0.25em] mb-2">
                <span>&gt; confidence</span>
                <span className="text-amber-glow">{b.confidence}%</span>
              </div>
              <pre className="text-amber-glow text-sm leading-none">
[{"█".repeat(Math.round(b.confidence / 5))}{"·".repeat(20 - Math.round(b.confidence / 5))}]
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border border-edge p-3">
                <div className="text-ink-secondary uppercase tracking-widest text-[10px] mb-1">topic</div>
                <div className="text-amber-glow">#{b.topic}</div>
              </div>
              <div className="border border-edge p-3">
                <div className="text-ink-secondary uppercase tracking-widest text-[10px] mb-1">centrality · revisions</div>
                <div className="text-amber-glow">★ {b.centrality} · {b.revisions}r</div>
              </div>
            </div>

            {/* Evidence */}
            {b.evidence?.length > 0 && (
              <div>
                <div className="text-[10px] text-ink-secondary uppercase tracking-[0.25em] mb-2">&gt; evidence</div>
                <ul className="space-y-1.5">
                  {b.evidence.map((e, i) => (
                    <li key={i} className="text-xs text-ink-primary pl-3 border-l border-edge">
                      <span className="text-amber-glow mr-2">·</span>{e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Crux */}
            <div className="border border-amber-glow/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] text-amber-glow uppercase tracking-[0.25em]">
                  &gt; crux · what would change my mind?
                </div>
                <button
                  onClick={runCrux}
                  disabled={computingCrux}
                  className="text-[10px] uppercase tracking-widest border border-amber-glow text-amber-glow px-2 py-1 hover:bg-amber-glow hover:text-void transition-colors disabled:opacity-50"
                  data-testid="compute-crux-btn"
                >
                  {computingCrux ? "computing…" : (b.cruxes ? "[recompute]" : "[compute]")}
                </button>
              </div>
              {!b.cruxes && (
                <div className="text-xs text-ink-secondary">
                  Click [compute] to identify the 2–3 upstream assumptions whose falsification would most change your mind.
                </div>
              )}
              {b.cruxes && b.cruxes.length === 0 && (
                <div className="text-xs text-ink-secondary">No cruxes identified.</div>
              )}
              {b.cruxes && b.cruxes.map((c, i) => (
                <div key={i} className="mb-3 last:mb-0 text-xs">
                  <div className="text-ink-primary mb-1">
                    <span className="text-amber-glow">→ assumption [{c.importance}/10]</span> {c.assumption}
                  </div>
                  <div className="text-ink-secondary pl-4">
                    <span className="text-conflict">! falsifier:</span> {c.falsifier}
                  </div>
                </div>
              ))}
            </div>

            {/* Upstream / Downstream / Contradictions */}
            {data.upstream?.length > 0 && (
              <Section title="upstream · I depend on">
                {data.upstream.map(u => (
                  <RelRow key={u.id} b={u} kind="depends_on" />
                ))}
              </Section>
            )}
            {data.downstream?.length > 0 && (
              <Section title="downstream · depends on me">
                {data.downstream.map(d => (
                  <RelRow key={d.id} b={d} kind={d._rel} />
                ))}
              </Section>
            )}
            {data.contradictions?.length > 0 && (
              <Section title="contradicts" tone="conflict">
                {data.contradictions.map(c => (
                  <RelRow key={c.id} b={c} kind="contradicts" />
                ))}
              </Section>
            )}

            {/* Revisions */}
            {data.revisions?.length > 0 && (
              <Section title={`revisions (${data.revisions.length})`}>
                {data.revisions.map(r => (
                  <div key={r.id} className="text-xs flex gap-2 border-l border-edge pl-2 py-0.5">
                    <span className="text-amber-glow w-3">{r.kind === "contradiction" ? "!" : r.kind === "created" ? "+" : "~"}</span>
                    <span className="text-ink-secondary">{r.created_at?.slice(0, 16).replace("T", " ")}</span>
                    <span className="text-ink-primary">{r.summary}</span>
                  </div>
                ))}
              </Section>
            )}

            {b.assumptions?.length > 0 && (
              <Section title="author-stated assumptions">
                {b.assumptions.map((a, i) => (
                  <div key={i} className="text-xs text-ink-secondary pl-2 border-l border-edge py-0.5">
                    <span className="text-amber-glow mr-2">·</span>{a}
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, tone }) {
  const accent = tone === "conflict" ? "text-conflict" : "text-ink-secondary";
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-[0.25em] mb-2 ${accent}`}>&gt; {title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RelRow({ b, kind }) {
  const tone = kind === "contradicts" ? "text-conflict" : kind === "supports" ? "text-aligned" : "text-amber-glow";
  return (
    <div className="text-xs flex gap-2 items-center">
      <span className={`${tone} w-12`}>{b.short_id}</span>
      <span className="text-ink-secondary">{b.confidence}%</span>
      <span className="text-ink-primary flex-1 truncate">{b.statement}</span>
    </div>
  );
}
