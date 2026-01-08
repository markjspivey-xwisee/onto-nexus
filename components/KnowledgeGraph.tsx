import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink, NodeType } from '../types';

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
  onNodeClick?: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ nodes, links, width, height, onNodeClick, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // 1. Define Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8]) // Zoom limits
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    // 2. Apply Zoom to SVG
    svg.call(zoom);

    // 3. Create a container group for all graph elements (this gets transformed)
    const container = svg.append("g");

    // Create a deep copy of data to avoid mutating props directly
    const graphNodes = nodes.map(d => ({ ...d }));
    const graphLinks = links.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(graphNodes)
      .force("link", d3.forceLink(graphLinks).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(40));

    // Arrow marker definition (defs in SVG, not container)
    const defs = svg.append("defs");
    defs.selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#64748b");

    // Links (Append to container)
    const link = container.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphLinks)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Link Labels (Append to container)
    const linkLabel = container.append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(graphLinks)
      .join("text")
      .text(d => d.predicate)
      .attr("font-size", "10px")
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("dy", -5);

    // Nodes (Append to container)
    const node = container.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(graphNodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", (event, d) => {
        // Stop propagation so zoom doesn't break
        event.stopPropagation();
        if (onNodeClick) {
          // Find the original node object from props matching this ID
          const originalNode = nodes.find(n => n.id === d.id);
          if (originalNode) onNodeClick(originalNode);
        }
      });

    // Node Circles
    node.append("circle")
      .attr("r", (d) => d.id === selectedNodeId ? 20 : 15) // Highlight selected
      .attr("fill", (d) => {
        switch (d.type) {
          case NodeType.Person: return "#3b82f6"; // blue
          case NodeType.Organization: return "#a855f7"; // purple
          case NodeType.Location: return "#22c55e"; // green
          case NodeType.Event: return "#ef4444"; // red
          default: return "#64748b"; // slate
        }
      })
      .attr("stroke", (d) => d.id === selectedNodeId ? "#ffffff" : "#fff")
      .attr("stroke-width", (d) => d.id === selectedNodeId ? 3 : 1.5)
      .attr("stroke-dasharray", (d) => d.id === selectedNodeId ? "3 2" : "none") // selection effect
      .style("cursor", "pointer");

    // Node Labels
    node.append("text")
      .text(d => d.label)
      .attr("x", 22)
      .attr("y", 5)
      .attr("stroke", "none")
      .attr("fill", "#e2e8f0")
      .attr("font-family", "monospace")
      .attr("font-size", "12px")
      .attr("font-weight", (d) => d.id === selectedNodeId ? "bold" : "normal");

    // Simulation Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height, selectedNodeId, onNodeClick]);

  return (
    <svg 
      ref={svgRef} 
      width={width} 
      height={height} 
      className="bg-slate-900 rounded-lg border border-slate-700 shadow-inner w-full touch-none"
      style={{ cursor: 'move' }}
      onClick={() => onNodeClick && onNodeClick(null as any)} // Deselect on background click
    />
  );
};

export default KnowledgeGraph;