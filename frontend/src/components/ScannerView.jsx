import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

export default function ScannerView({ api, beliefs, onSelect }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [claims, setClaims] = useState(null);

  const run = async () => {
    const t = text.trim();
    if (t.length < 20) {
      toast.error("paste a longer article (>= 20 chars)");
      return;
    }
    if (!beliefs.length) {
      toast.error("record some beliefs first");
      return;
    }
    setRunning(true);
    setClaims(null);
    try {
      const r = await axios.post(`${api}/scan`, { text: t });
      setClaims(r.data?.claims || []);
      const n = (r.data?.claims || []).length;
      const conflicts = (r.data?.claims || []).filter(c => c.relation === "conflict").length;
      toast.success(`scanned · ${n} relevant claims · ${conflicts} conflicts`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "scan failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 divide-x divide-edge min-h-[600px]" data-testid="scanner-view">
      <div className="p-5 flex flex-col gap-3">
        <div className="text-xs text-ink-secondary uppercase tracking-[0.25em]">
          &gt; paste_input · article / conversation / transcript
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="// paste an article, chat log, or anyone's argument. The scanner returns only the lines that actually engage with what you already believe — ranked by how central those beliefs are."
          className="flex-1 min-h-[400px] bg-void border border-edge text-ink-primary p-4 text-sm font-mono leading-relaxed rounded-none resize-none focus:outline-none focus:border-amber-glow focus:ring-1 focus:ring-amber-glow transition-colors placeholder:text-ink-secondary/50"
          data-testid="scanner-textarea"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ink-secondary uppercase tracking-widest">
            {text.length} chars · {beliefs.length} stored beliefs
          </span>
          <button
            onClick={run}
            disabled={running}
            className="bg-amber-glow text-void font-bold uppercase tracking-[0.2em] text-xs px-5 py-2.5 border border-amber-glow hover:bg-amber-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            data-testid="run-scan-btn"
          >
            {running ? <span>scanning<span className="animate-blink">█</span></span> : <span>[ scan ]</span>}
          </button>
        </div>
      </div>

      <div className="p-5 overflow-y-auto">
        <div className="text-xs text-ink-secondary uppercase tracking-[0.25em] mb-4">
          &gt; diff_output {claims && `· ${claims.length} hits`}
        </div>

        {claims === null && !running && (
          <div className="text-xs text-ink-secondary">
            Output appears here. Conflicts ranked by belief centrality.
          </div>
        )}

        {running && (
          <div className="text-xs text-amber-glow">
            running diff against {beliefs.length} beliefs<span className="animate-blink">█</span>
          </div>
        )}

        {claims && claims.length === 0 && (
          <div className="text-xs text-ink-secondary border border-edge p-3">
            // no claims in this text intersected your ledger.
          </div>
        )}

        <div className="space-y-3">
          {claims && claims.map((c, i) => {
            const conflict = c.relation === "conflict";
            return (
              <button
                key={i}
                onClick={() => c.belief && onSelect && onSelect(c.belief.id)}
                className={`w-full text-left border-l-2 ${conflict ? "border-conflict bg-conflict/[0.06]" : "border-aligned bg-aligned/[0.06]"} p-3 hover:bg-void-surface transition-colors`}
                data-testid={`scan-claim-${i}`}
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-2">
                  <span className={conflict ? "text-conflict" : "text-aligned"}>
                    {conflict ? "− conflict" : "+ aligned"}
                  </span>
                  <span className="text-ink-secondary">
                    severity {c.severity}/10 · score {c.score}
                  </span>
                </div>
                <div className="text-sm text-ink-primary mb-2 leading-snug">
                  "{c.quote}"
                </div>
                {c.belief && (
                  <div className="text-xs text-ink-secondary border-t border-edge pt-2">
                    <span className="text-amber-glow">{c.belief.short_id}</span>
                    <span className="mx-1">·</span>
                    <span>{c.belief.statement}</span>
                  </div>
                )}
                {c.explanation && (
                  <div className="text-[11px] text-ink-secondary/80 mt-1 italic">
                    // {c.explanation}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
