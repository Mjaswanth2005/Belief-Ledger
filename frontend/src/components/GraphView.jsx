import { useRef, useEffect, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Network } from "lucide-react";
import { useTheme } from "@/theme";

const LINK_COLOR_LIGHT = {
  depends_on: "rgba(26, 26, 26, 0.55)",
  contradicts: "rgba(232, 120, 120, 0.95)",
  supports: "rgba(125, 214, 143, 0.95)",
};
const LINK_COLOR_DARK = {
  depends_on: "rgba(245, 239, 216, 0.55)",
  contradicts: "rgba(232, 120, 120, 0.95)",
  supports: "rgba(125, 214, 143, 0.95)",
};

export default function GraphView({ graph, onSelect, onSeed, seeding }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const bgColor = dark ? "#15140E" : "#FBF7E8";
  const inkColor = dark ? "#F5EFD8" : "#1A1A1A";
  const linkColors = dark ? LINK_COLOR_DARK : LINK_COLOR_LIGHT;
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(400, e.contentRect.height) });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const drawNode = useCallback((node, ctx, globalScale) => {
    const label = node.short_id;
    const fontSize = 12 / globalScale;
    const r = 8 + Math.min(node.centrality || 0, 6) * 1.5;
    const isHover = hover && hover.id === node.id;

    // Hard shadow (brutalist)
    ctx.fillStyle = inkColor;
    ctx.beginPath();
    ctx.arc(node.x + 2 / globalScale, node.y + 2 / globalScale, r, 0, 2 * Math.PI);
    ctx.fill();

    // Node fill — confidence-based pastel
    const conf = node.confidence || 50;
    let fill = dark ? "#26241D" : "#FFFFFF";
    if (conf >= 80) fill = "#A7E8B5";
    else if (conf >= 60) fill = "#F4D96B";
    else if (conf >= 40) fill = "#F5B5D1";
    else fill = "#F5A5A5";

    ctx.fillStyle = isHover ? inkColor : fill;
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2 / globalScale;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.font = `bold ${fontSize}px "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isHover ? (dark ? "#15140E" : "#FFFFFF") : inkColor;
    ctx.fillText(label, node.x + r + 6, node.y);
  }, [hover, dark, inkColor]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="p-10 text-center" data-testid="graph-empty">
        <div className="inline-block w-20 h-20 bg-sky border-2 border-ink rounded-2xl shadow-brutal mb-4 flex items-center justify-center">
          <Network className="w-10 h-10 text-ink" strokeWidth={2.5} />
        </div>
        <h3 className="font-display text-2xl mb-2">Empty graph</h3>
        <p className="text-sm text-ink/60 mb-5">Once you have a few beliefs, you'll see how they connect.</p>
        {onSeed && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="btn-brutal-lg bg-mint px-5 py-3 text-base"
            data-testid="seed-from-graph-btn"
          >{seeding ? "Loading…" : "Load demo ledger"}</button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[600px]" ref={wrapRef} data-testid="graph-view">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-paper border-2 border-ink rounded-xl shadow-brutal-sm p-3 text-xs font-bold">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-4 h-0.5 bg-ink" /> depends on
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-4 h-0.5 bg-coral-deep" /> contradicts
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-0.5 bg-mint-deep" /> supports
        </div>
      </div>

      {/* Confidence legend */}
      <div className="absolute top-4 right-4 z-10 bg-paper border-2 border-ink rounded-xl shadow-brutal-sm p-3 text-xs font-bold flex items-center gap-3">
        <span>confidence:</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-coral border border-ink rounded-full" />low</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-butter border border-ink rounded-full" />mid</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-mint border border-ink rounded-full" />high</span>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graph}
        width={size.w}
        height={size.h}
        backgroundColor={bgColor}
        nodeRelSize={6}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={(l) => linkColors[l.kind] || (dark ? "rgba(245,239,216,0.4)" : "rgba(26,26,26,0.4)")}
        linkWidth={(l) => (l.kind === "contradicts" ? 3 : l.kind === "supports" ? 2.5 : 1.5)}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.85}
        linkDirectionalArrowColor={(l) => linkColors[l.kind] || inkColor}
        onNodeHover={setHover}
        onNodeClick={(node) => onSelect && onSelect(node.id)}
        cooldownTicks={120}
        d3VelocityDecay={0.3}
      />
      {hover && (
        <div className="absolute bottom-4 left-4 right-4 bg-paper border-2 border-ink rounded-xl shadow-brutal p-3 max-w-xl">
          <div className="flex items-center justify-between mb-1 text-xs font-bold">
            <span className="font-mono px-2 py-0.5 bg-pinky border border-ink rounded">{hover.short_id}</span>
            <span>conf {hover.confidence}% · ★ {hover.centrality}</span>
          </div>
          <div className="text-sm text-ink leading-snug">{hover.label}</div>
        </div>
      )}
    </div>
  );
}
