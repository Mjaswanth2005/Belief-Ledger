import { useRef, useEffect, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";

const LINK_COLOR = {
  depends_on: "rgba(255, 176, 0, 0.55)",
  contradicts: "rgba(239, 68, 68, 0.7)",
  supports: "rgba(16, 185, 129, 0.55)",
};

export default function GraphView({ graph, onSelect }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: Math.max(200, e.contentRect.width), h: Math.max(300, e.contentRect.height) });
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const drawNode = useCallback((node, ctx, globalScale) => {
    const label = node.short_id;
    const fontSize = 11 / globalScale;
    const r = 4 + Math.min(node.centrality || 0, 6);
    const isHover = hover && hover.id === node.id;

    // Glow on hover
    if (isHover) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255, 176, 0, 0.15)";
      ctx.fill();
    }

    // Node fill (confidence intensity)
    const intensity = Math.max(20, node.confidence) / 100;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(17, 17, 17, 1)`;
    ctx.fill();
    ctx.lineWidth = 1.5 / globalScale;
    ctx.strokeStyle = `rgba(255, 176, 0, ${0.3 + 0.7 * intensity})`;
    ctx.stroke();

    // Label
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isHover ? "#FFB000" : "#888888";
    ctx.fillText(label, node.x + r + 4, node.y);
  }, [hover]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="p-8 text-center text-ink-secondary text-sm" data-testid="graph-empty">
        <pre className="inline-block text-left text-amber-glow/60 text-xs leading-snug mb-4">
{`     ┌─────────────────────┐
     │   GRAPH EMPTY       │
     │   No nodes yet.     │
     └─────────────────────┘`}
        </pre>
        <div>Submit entries to populate the dependency graph.</div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[600px]" ref={wrapRef} data-testid="graph-view">
      <div className="absolute top-3 left-4 z-10 text-[10px] uppercase tracking-[0.25em] text-ink-secondary">
        &gt; force_graph · drag nodes · click to inspect
      </div>
      <div className="absolute top-3 right-4 z-10 text-[10px] uppercase tracking-[0.2em] flex gap-3">
        <span className="text-amber-glow/80">— depends_on</span>
        <span className="text-conflict/80">— contradicts</span>
        <span className="text-aligned/80">— supports</span>
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={graph}
        width={size.w}
        height={size.h}
        backgroundColor="#050505"
        nodeRelSize={5}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={(l) => LINK_COLOR[l.kind] || "#262626"}
        linkWidth={(l) => (l.kind === "contradicts" ? 1.5 : 1)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.85}
        linkDirectionalArrowColor={(l) => LINK_COLOR[l.kind] || "#262626"}
        onNodeHover={setHover}
        onNodeClick={(node) => onSelect && onSelect(node.id)}
        cooldownTicks={120}
        d3VelocityDecay={0.3}
      />
      {hover && (
        <div className="absolute bottom-4 left-4 right-4 border border-amber-glow bg-void p-3 text-xs max-w-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-amber-glow">{hover.short_id}</span>
            <span className="text-ink-secondary">conf {hover.confidence}% · ★ {hover.centrality}</span>
          </div>
          <div className="text-ink-primary leading-snug">{hover.label}</div>
        </div>
      )}
    </div>
  );
}
