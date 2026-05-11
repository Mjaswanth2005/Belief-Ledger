import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Brain, RefreshCw, Trash2, Sparkles, Sun, Moon } from "lucide-react";
import Composer from "@/components/Composer";
import LedgerView from "@/components/LedgerView";
import GraphView from "@/components/GraphView";
import ScannerView from "@/components/ScannerView";
import CruxView from "@/components/CruxView";
import BeliefDetail from "@/components/BeliefDetail";
import ExtractionResult from "@/components/ExtractionResult";
import { useTheme } from "@/theme";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { id: "ledger", label: "Ledger", color: "bg-mint", hint: "Your belief history" },
  { id: "graph", label: "Graph", color: "bg-sky", hint: "Dependency map" },
  { id: "crux", label: "Crux", color: "bg-pinky", hint: "What would change my mind?" },
  { id: "scanner", label: "Scanner", color: "bg-butter", hint: "Spot conflicts in any text" },
];

export default function Dashboard() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState("ledger");
  const [beliefs, setBeliefs] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastExtraction, setLastExtraction] = useState(null);
  const [seeding, setSeeding] = useState(false);

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
      toast.error(`Couldn't load: ${e?.message || e}`);
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
      toast.success(`Captured ${n} belief${n === 1 ? "" : "s"}${contradictions.length ? ` · ${contradictions.length} contradiction!` : ""}`);
      await refresh();
      setLastExtraction(res.data);
      return res.data;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Extraction failed");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Wipe everything? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/reset`);
      setLastExtraction(null);
      toast.success("Reset complete");
      await refresh();
    } catch {
      toast.error("Reset failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/beliefs/${id}`);
      setSelectedId(null);
      toast.success("Belief deleted");
      await refresh();
    } catch { toast.error("Delete failed"); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/seed-demo`);
      toast.success("Demo loaded — explore it!");
      await refresh();
      setLastExtraction(null);
    } catch { toast.error("Seed failed"); }
    finally { setSeeding(false); }
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="dashboard">
      {/* Header */}
      <header className="border-b-2 border-ink bg-cream px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-14 bg-pinky border-2 border-ink rounded-2xl shadow-brutal flex items-center justify-center">
            <Brain className="w-7 h-7 text-ink" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-ink leading-none">Belief Ledger</h1>
            <p className="text-xs sm:text-sm text-ink/60 mt-0.5">Your endless journey to clarity</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Pill color="bg-mint" testId="belief-count">{beliefs.length} beliefs</Pill>
          <Pill color="bg-butter" testId="revision-count">{ledger.length} revisions</Pill>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="btn-brutal bg-sky px-3 py-2 text-sm gap-1.5 disabled:opacity-60"
            data-testid="seed-demo-btn"
            title="Wipe + seed demo data"
          >
            <Sparkles className="w-4 h-4" /> {seeding ? "Seeding…" : "Demo"}
          </button>
          <button
            onClick={refresh}
            className="btn-brutal bg-paper p-2"
            data-testid="refresh-btn"
            title="Refresh"
          ><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
          <button
            onClick={toggleTheme}
            className="btn-brutal bg-paper p-2"
            data-testid="theme-toggle-btn"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle appearance"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleReset}
            className="btn-brutal bg-coral px-3 py-2 text-sm gap-1.5"
            data-testid="reset-btn"
          ><Trash2 className="w-4 h-4" /> Reset</button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6 p-6">
        <aside className="lg:max-h-[calc(100vh-128px)] lg:overflow-y-auto pr-1">
          <Composer onSubmit={handleSubmitEntry} submitting={submitting} />
          {lastExtraction && (
            <ExtractionResult
              result={lastExtraction}
              api={API}
              beliefs={beliefs}
              onOpenBelief={setSelectedId}
              onClose={() => setLastExtraction(null)}
            />
          )}
        </aside>

        <main className="flex flex-col lg:max-h-[calc(100vh-128px)] gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-3" data-testid="tabs">
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`tab-${t.id}`}
                  className={`btn-brutal px-5 py-3 text-base ${active ? `${t.color} shadow-brutal translate-x-0 translate-y-0` : "bg-paper hover:-translate-y-0.5 hover:shadow-brutal"} transition-all`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Active tab hint */}
          <div className="text-sm text-ink/60 font-medium">
            {TABS.find(t => t.id === tab)?.hint}
          </div>

          {/* Content panel */}
          <div className="flex-1 overflow-hidden bg-paper border-2 border-ink rounded-2xl shadow-brutal-lg">
            <div className="h-full overflow-y-auto">
              {tab === "ledger" && (
                <LedgerView revisions={ledger} beliefs={beliefs} onSelect={setSelectedId} onSeed={handleSeed} seeding={seeding} />
              )}
              {tab === "graph" && (
                <GraphView graph={graph} onSelect={setSelectedId} onSeed={handleSeed} seeding={seeding} />
              )}
              {tab === "crux" && (
                <CruxView api={API} onSelect={setSelectedId} />
              )}
              {tab === "scanner" && (
                <ScannerView api={API} beliefs={beliefs} onSelect={setSelectedId} />
              )}
            </div>
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

function Pill({ children, color, testId }) {
  return (
    <span
      className={`hidden sm:inline-flex items-center font-bold text-sm px-3 py-1.5 border-2 border-ink rounded-full ${color} shadow-brutal-sm`}
      data-testid={testId}
    >{children}</span>
  );
}
