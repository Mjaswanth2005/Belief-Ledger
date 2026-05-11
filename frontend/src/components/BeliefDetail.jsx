import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Trash2, Target, AlertTriangle, ArrowRight, Zap } from "lucide-react";

export default function BeliefDetail({ beliefId, api, onClose, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [computingCrux, setComputingCrux] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get(`${api}/beliefs/${beliefId}`)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => toast.error("Couldn't load belief"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [beliefId, api]);

  const runCrux = async () => {
    setComputingCrux(true);
    try {
      const r = await axios.post(`${api}/beliefs/${beliefId}/crux`);
      setData(prev => ({ ...prev, belief: { ...prev.belief, cruxes: r.data.cruxes } }));
      toast.success(`Found ${r.data.cruxes.length} crux${r.data.cruxes.length === 1 ? "" : "es"}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Crux failed"); }
    finally { setComputingCrux(false); }
  };

  const b = data?.belief;

  return (
    <div
      className="fixed inset-0 bg-ink/40 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
      data-testid="belief-detail-overlay"
    >
      <div
        className="w-full max-w-3xl bg-paper border-2 border-ink rounded-2xl shadow-brutal-xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-pinky border-b-2 border-ink px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2 font-bold">
            <Target className="w-5 h-5" />
            <span className="font-display text-lg">Belief</span>
            <span className="font-mono text-sm px-2 py-0.5 bg-paper border border-ink rounded">{b?.short_id || "…"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete && onDelete(beliefId)}
              className="btn-brutal bg-coral px-2 py-1.5 text-xs gap-1"
              data-testid="delete-belief-btn"
            ><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            <button
              onClick={onClose}
              className="btn-brutal bg-paper p-1.5"
              data-testid="close-belief-btn"
            ><X className="w-4 h-4" /></button>
          </div>
        </div>

        {loading || !b ? (
          <div className="p-10 text-center font-bold animate-pulse">Loading…</div>
        ) : (
          <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
            <div>
              <Label>Statement</Label>
              <p className="font-display text-xl leading-snug mt-1">{b.statement}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Confidence</Label>
                <span className="font-bold text-2xl">{b.confidence}%</span>
              </div>
              <div className="h-5 bg-cream border-2 border-ink rounded-full overflow-hidden">
                <div className="h-full bg-mint border-r-2 border-ink" style={{ width: `${b.confidence}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Topic" value={`#${b.topic}`} bg="bg-lavender" />
              <Stat label="Centrality / Revisions" value={`★ ${b.centrality} · ${b.revisions}r`} bg="bg-butter" />
            </div>

            {b.evidence?.length > 0 && (
              <div>
                <Label>Evidence</Label>
                <ul className="space-y-2 mt-2">
                  {b.evidence.map((e, i) => (
                    <li key={i} className="text-sm pl-3 border-l-4 border-mint">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Crux */}
            <div className="bg-pinky/30 border-2 border-ink rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <Label>What would change my mind?</Label>
                <button
                  onClick={runCrux}
                  disabled={computingCrux}
                  className="btn-brutal bg-paper px-3 py-1.5 text-xs gap-1.5 disabled:opacity-50"
                  data-testid="compute-crux-btn"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {computingCrux ? "Thinking…" : (b.cruxes ? "Recompute" : "Compute")}
                </button>
              </div>
              {!b.cruxes && (
                <p className="text-sm text-ink/70">Find the 2–3 upstream assumptions whose falsification would most change your mind.</p>
              )}
              {b.cruxes && b.cruxes.length === 0 && <p className="text-sm text-ink/60">No cruxes identified.</p>}
              {b.cruxes && b.cruxes.map((c, i) => (
                <div key={i} className="bg-paper border-2 border-ink rounded-lg p-3 mt-2">
                  <div className="text-sm font-semibold flex items-start gap-2 mb-1">
                    <span className="shrink-0 w-6 h-6 bg-pinky border-2 border-ink rounded text-xs flex items-center justify-center font-bold">{c.importance}</span>
                    <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{c.assumption}</span>
                  </div>
                  <div className="text-sm text-ink/80 pl-8 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-coral-deep" />
                    <span><span className="font-bold">Falsifier:</span> {c.falsifier}</span>
                  </div>
                </div>
              ))}
            </div>

            {data.contradictions?.length > 0 && (
              <Section title="Contradicts" tone="coral">
                <div className="space-y-3">
                  {data.contradictions.map(c => (
                    <div key={c.id} className="border-2 border-ink rounded-xl p-3 bg-coral/20" data-testid={`contradiction-${c.short_id}`}>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-bold text-ink/60 mb-1">this belief</div>
                          <div className="text-sm font-medium line-clamp-2 mb-2">{b.statement}</div>
                          <div className="h-3 bg-paper border-2 border-ink rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-mint" style={{ width: `${b.confidence}%` }} />
                          </div>
                          <div className="text-xs font-bold text-ink/60">{b.short_id} · {b.confidence}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-bold text-coral-deep mb-1">conflicts with</div>
                          <div className="text-sm font-medium line-clamp-2 mb-2">{c.statement}</div>
                          <div className="h-3 bg-paper border-2 border-ink rounded-full overflow-hidden mb-1">
                            <div className="h-full bg-coral-deep" style={{ width: `${c.confidence}%` }} />
                          </div>
                          <div className="text-xs font-bold text-ink/60">{c.short_id} · {c.confidence}%</div>
                        </div>
                      </div>
                      {b.confidence >= 70 && c.confidence >= 70 && (
                        <div className="mt-2 text-xs font-bold text-coral-deep">⚠ High-confidence collision — review your evidence</div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {data.upstream?.length > 0 && (
              <Section title="Depends on">
                {data.upstream.map(u => <RelRow key={u.id} b={u} kind="depends_on" />)}
              </Section>
            )}
            {data.downstream?.length > 0 && (
              <Section title="Beliefs that depend on this">
                {data.downstream.map(d => <RelRow key={d.id} b={d} kind={d._rel} />)}
              </Section>
            )}

            {data.revisions?.length > 0 && (
              <Section title={`Revisions (${data.revisions.length})`}>
                <div className="space-y-1.5">
                  {data.revisions.map(r => (
                    <div key={r.id} className="text-sm pl-3 border-l-2 border-ink/30 py-0.5">
                      <span className="text-xs font-bold text-ink/50 mr-2">{r.created_at?.slice(0, 16).replace("T", " ")}</span>
                      {r.summary}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {b.assumptions?.length > 0 && (
              <Section title="Assumptions">
                <ul className="space-y-1.5">
                  {b.assumptions.map((a, i) => (
                    <li key={i} className="text-sm pl-3 border-l-2 border-ink/30">{a}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div className="text-xs uppercase tracking-wider font-bold text-ink/60">{children}</div>;
}

function Stat({ label, value, bg }) {
  return (
    <div className={`${bg} border-2 border-ink rounded-xl p-3`}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink/70">{label}</div>
      <div className="font-bold text-base">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <Label>{title}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function RelRow({ b, kind }) {
  const bg = kind === "contradicts" ? "bg-coral" : kind === "supports" ? "bg-mint" : "bg-sky";
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className={`font-mono text-xs px-2 py-0.5 ${bg} border border-ink rounded`}>{b.short_id}</span>
      <span className="text-xs font-bold text-ink/60">{b.confidence}%</span>
      <span className="flex-1 truncate">{b.statement}</span>
    </div>
  );
}
