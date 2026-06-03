import { Background, Controls, ReactFlow, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitFork, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildResultGraph } from "../lib/graph";
import { useStore } from "../store";
import { GraphFitter, ResultNodeView } from "./ResultNode";
import { PaneTitle } from "./Primitives";

const resultNodeTypes: NodeTypes = { result: ResultNodeView };

// On touch/narrow screens the canvas must not trap page scrolling: React Flow's
// pan/zoom gestures otherwise capture the touch and the page can't scroll past
// the graph. Disable canvas gestures there and let the page own scrolling.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const handler = () => setIsMobile(query.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function GraphCanvas() {
  const sourceAsset = useStore((state) => state.sourceAsset);
  const prepCandidates = useStore((state) => state.prepCandidates);
  const jobs = useStore((state) => state.jobs);
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const preparingFrame = useStore((state) => state.preparingFrame);
  const submitting = useStore((state) => state.submitting);
  const loaderVisible = useStore((state) => state.loaderVisible);
  const openImage = useStore((state) => state.openImage);
  const selectNode = useStore((state) => state.selectNode);
  const isMobile = useIsMobile();

  const graph = useMemo(
    () =>
      buildResultGraph({
        sourceAsset,
        prepCandidates,
        jobs,
        selectedNodeId,
        preparingFrame,
        submitting,
        onOpenImage: openImage,
      }),
    [sourceAsset, prepCandidates, jobs, selectedNodeId, preparingFrame, submitting, openImage],
  );

  return (
    <div className="graph-pane">
      <PaneTitle
        icon={<GitFork size={18} />}
        title="Run Graph"
        description="Each node is one run · branch to fork"
      />
      <div className="operator-canvas" aria-label="Image to video result graph">
        {loaderVisible && (
          <div className="graph-loader" aria-live="polite">
            <Loader2 className="spin" size={16} />
            <span>loading…</span>
          </div>
        )}
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={resultNodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.24, maxZoom: 1.1, minZoom: 0.3 }}
          minZoom={0.3}
          maxZoom={1.6}
          panOnDrag={!isMobile}
          panOnScroll={false}
          zoomOnScroll={!isMobile}
          zoomOnPinch={!isMobile}
          zoomOnDoubleClick={!isMobile}
          preventScrolling={!isMobile}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => selectNode(node.id, node.data.kind)}
        >
          <GraphFitter signature={graph.nodes.map((node) => node.id).join("|")} />
          <Background color="#72786f" gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
