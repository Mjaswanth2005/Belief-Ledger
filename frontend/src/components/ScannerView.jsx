import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Search, AlertTriangle, CheckCircle2, FileSearch } from "lucide-react";

export default function ScannerView({ api, beliefs, onSelect }) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [claims, setClaims] = useState(null);

  const run = async () => {
    const t = text.trim();
    if (t.length < 20) return toast.error("Paste a longer text (≥ 20 chars)");
    if (!beliefs.length) return toast.error("Record some beliefs first");
    setRunning(true);
    setClaims(null);
    try {
      const r = await axios.post(`${api}/scan`, { text: t });
      setClaims(r.data?.claims || []);
      const n = (r.data?.claims || []).length;
      const conflicts = (r.data?.claims || []).filter(c => c.relation === "conflict").length;
      toast.success(`Found ${n} relevant claim${n === 1 ? "" : "s"} · ${conflicts} conflict${conflicts === 1 ? "" : "s"}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Scan failed"); }
    finally { setRunning(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x-2 divide-ink/10 min-h-[600px]" data-testid="scanner-view">
      {/* Input */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5" />
          <h3 className="font-display text-lg">Scan a text</h3>
        </div>
        <p className="text-sm text-ink/70 leading-relaxed">
          Paste an article, chat log, or someone's argument. The scanner highlights only the lines that actually engage with what you already believe — ranked by how central those beliefs are.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste anything — a blog post, a friend's argument, a tweet thread…"
          className="flex-1 min-h-[320px] bg-cream-soft border-2 border-ink rounded-xl p-4 text-sm font-sans leading-relaxed resize-none focus:outline-none focus:ring-4 focus:ring-butter/60 transition-all placeholder:text-ink/40"
          data-testid="scanner-textarea"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink/50 font-bold">
            {text.length} chars · {beliefs.length} beliefs to check against
          </span>
          <button
            onClick={run}
            disabled={running}
            className="btn-brutal-lg bg-butter px-5 py-3 text-base gap-2 disabled:opacity-50"
            data-testid="run-scan-btn"
          >
            <Search className="w-4 h-4" />
            {running ? "Scanning…" : "Scan"}
          </button>
        </div>
      </div>

      {/* Output */}
      <div className="p-5 overflow-y-auto">
        <h3 className="font-display text-lg mb-4">
          Results {claims && <span className="text-ink/40 text-base">· {claims.length} hits</span>}
        </h3>

        {claims === null && !running && (
          <div className="bg-cream-soft border-2 border-dashed border-ink/40 rounded-xl p-6 text-center">
            <FileSearch className="w-8 h-8 mx-auto mb-2 text-ink/40" />
            <p className="text-sm text-ink/60">Output appears here. Conflicts are ranked by belief centrality.</p>
          </div>
        )}

        {running && (
          <div className="bg-butter/30 border-2 border-ink rounded-xl p-4 font-bold animate-pulse">
            Diffing against {beliefs.length} beliefs…
          </div>
        )}

        {claims && claims.length === 0 && (
          <div className="bg-cream-soft border-2 border-ink rounded-xl p-4 text-sm text-ink/60">
            Nothing in this text intersected your ledger. Try a more opinionated piece.
          </div>
        )}

        <div className="space-y-3">
          {claims && claims.map((c, i) => {
            const conflict = c.relation === "conflict";
            const Icon = conflict ? AlertTriangle : CheckCircle2;
            const bg = conflict ? "bg-coral" : "bg-mint";
            return (
              <button
                key={i}
                onClick={() => c.belief && onSelect && onSelect(c.belief.id)}
                className="w-full text-left bg-paper border-2 border-ink rounded-xl p-4 hover:shadow-brutal hover:-translate-y-0.5 transition-all"
                data-testid={`scan-claim-${i}`}
              >
                <div className="flex items-center gap-2 mb-2 text-xs font-bold">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 ${bg} border-2 border-ink rounded-full`}>
                    <Icon className="w-3 h-3" />
                    {conflict ? "Conflict" : "Aligned"}
                  </span>
                  <span className="ml-auto text-ink/60">
                    severity {c.severity}/10 · score {c.score}
                  </span>
                </div>
                <div className="text-sm text-ink leading-snug mb-3 font-medium">
                  "{c.quote}"
                </div>
                {c.belief && (
                  <div className="text-xs text-ink/70 border-t-2 border-ink/10 pt-2">
                    <span className="font-mono px-1.5 py-0.5 bg-cream border border-ink/40 rounded mr-2">{c.belief.short_id}</span>
                    <span>{c.belief.statement}</span>
                  </div>
                )}
                {c.explanation && (
                  <div className="text-xs text-ink/60 mt-1.5 italic">{c.explanation}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
