import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import Composer from "@/components/Composer";
import LedgerView from "@/components/LedgerView";
import GraphView from "@/components/GraphView";
import ScannerView from "@/components/ScannerView";
import BeliefDetail from "@/components/BeliefDetail";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { id: "ledger", label: "LEDGER", hint: "git log of beliefs" },
  { id: "graph", label: "GRAPH", hint: "dependency map" },
  { id: "scanner", label: "SCANNER", hint: "external claim diff" },
];

export default function Dashboard() {
  const [tab, setTab] = useState("ledger");
  const [beliefs, setBeliefs] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, l, g] = await Promise.all([
        axios.get(`${API}/beliefs`),
        axios.get(`${API}/ledger`),
        axios.get(`${API}/graph`),
      ]);
      setBeliefs(b.data || []);
      setLedger(l.data || []);
      setGraph(g.data || { nodes: [], links: [] });
    } catch (e) {
      toast.error(`fetch failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmitEntry = async (text) => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/entries`, { text });
      const n = res.data?.count || 0;
      const contradictions = (res.data?.results || []).flatMap(r =>
        (r.relationships || []).filter(x => x.relation === "contradiction")
      );
      toast.success(`extracted ${n} belief${n === 1 ? "" : "s"}${contradictions.length ? ` · ${contradictions.length} contradiction(s)` : ""}`);
      await refresh();
      return res.data;
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "extraction failed";
      toast.error(`> err: ${msg}`);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Wipe entire ledger? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/reset`);
      toast.success("ledger reset");
      await refresh();
    } catch (e) {
      toast.error("reset failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/beliefs/${id}`);
      setSelectedId(null);
      toast.success("belief deleted");
      await refresh();
    } catch (e) {
      toast.error("delete failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="dashboard">
      {/* Header */}
      <header className="border-b border-edge px-6 py-3 flex items-center justify-between bg-void">
        <div className="flex items-center gap-4">
          <div className="text-amber-glow font-bold tracking-[0.3em] text-sm">
            &gt;_ BELIEF_LEDGER
          </div>
          <div className="text-ink-secondary text-xs hidden sm:block">
            v0.1 · personal epistemic ledger
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-secondary">
          <span data-testid="belief-count">[{beliefs.length}] beliefs</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline" data-testid="revision-count">[{ledger.length}] revisions</span>
          <button
            onClick={handleReset}
            className="ml-3 border border-edge px-2 py-1 hover:border-conflict hover:text-conflict transition-colors"
            data-testid="reset-btn"
            title="wipe everything"
          >[reset]</button>
        </div>
      </header>

      {/* Body grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr]">
        {/* Composer column */}
        <aside className="border-r border-edge p-5 lg:max-h-[calc(100vh-57px)] lg:overflow-y-auto">
          <Composer onSubmit={handleSubmitEntry} submitting={submitting} />
        </aside>

        {/* Main column */}
        <main className="flex flex-col lg:max-h-[calc(100vh-57px)]">
          {/* Tabs */}
          <div className="border-b border-edge flex" data-testid="tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`px-5 py-3 text-xs tracking-[0.25em] uppercase border-r border-edge transition-colors ${
                  tab === t.id
                    ? "text-amber-glow border-b-2 border-b-amber-glow bg-void-surface"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-void-hover"
                }`}
              >
                [{t.label}]
                <span className="hidden xl:inline ml-2 text-[10px] normal-case tracking-normal text-ink-secondary/60">
                  {t.hint}
                </span>
              </button>
            ))}
            <div className="ml-auto px-5 py-3 text-[10px] text-ink-secondary/60 self-center">
              {loading ? <span className="text-amber-glow">syncing…</span> : <span>idle</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "ledger" && (
              <LedgerView
                revisions={ledger}
                beliefs={beliefs}
                onSelect={setSelectedId}
              />
            )}
            {tab === "graph" && (
              <GraphView
                graph={graph}
                onSelect={setSelectedId}
              />
            )}
            {tab === "scanner" && (
              <ScannerView api={API} beliefs={beliefs} onSelect={setSelectedId} />
            )}
          </div>
        </main>
      </div>

      {selectedId && (
        <BeliefDetail
          beliefId={selectedId}
          api={API}
          onClose={() => setSelectedId(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
