
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
  searchTerm?: string;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ 
  nodes, 
  links, 
  width, 
  height, 
  onNodeClick, 
  selectedNodeId,
  searchTerm 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  // Initialize SVG and Simulation once
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    
    // Clear any existing content if we are mounting afresh
    svg.selectAll("*").remove();

    // 1. Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        if (gRef.current) gRef.current.attr("transform", event.transform);
      });
    svg.call(zoom);

    // 2. Container
    const g = svg.append("g");
    gRef.current = g;

    // 3. Arrow Markers
    const defs = svg.append("defs");
    defs.append("marker")
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

    defs.append("marker")
      .attr("id", "arrow-ontology")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#a855f7");

    // 4. Force Simulation Init
    simulationRef.current = d3.forceSimulation<GraphNode>()
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide((d: any) => d.type === NodeType.Class ? 50 : 30));

    // Cleanup
    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [width, height]);

  // Update Data and Rendering
  useEffect(() => {
    if (!simulationRef.current || !gRef.current) return;

    const simulation = simulationRef.current;
    const g = gRef.current;

    // Clone data to avoid mutating props, but try to preserve object references for existing nodes if possible
    // (In a real app, we might do complex reconciliation here, but simple mapping is usually okay if we trust D3 ID matching)
    // However, since we are receiving NEW arrays from React state, we must tell D3 how to identify them.
    // D3's forceSimulation doesn't automatically merge properties from new data objects into old ones unless we do it manually.
    // A simplified approach for "smoothness":
    // The parent (App) should ideally provide stable object references. 
    // If App provides new objects every time, D3 will re-initialize them (x,y=0). 
    // We can rely on D3's .data(..., key) to match DOM elements, but the *simulation* needs help.
    // We will just pass the new nodes to simulation.nodes(). 
    // To prevent jumping, we must copy x,y,vx,vy from old nodes if ID matches.

    const oldNodesMap = new Map<string, GraphNode>(simulation.nodes().map(n => [n.id, n]));
    
    const newNodes = nodes.map(n => {
      const old = oldNodesMap.get(n.id);
      if (old) {
        return { ...n, x: old.x, y: old.y, vx: old.vx, vy: old.vy };
      }
      return { ...n };
    });

    const newLinks = links.map(l => ({ ...l }));

    // Update Simulation Data
    simulation.nodes(newNodes);
    simulation.force("link", d3.forceLink(newLinks)
      .id((d: any) => d.id)
      .distance((d: any) => d.isOntologyLink ? 180 : 120)
    );
    
    // Re-heat simulation just a bit to settle new nodes, but not too much to cause explosion
    simulation.alpha(0.1).restart();

    // --- DRAW LINKS ---
    // Join pattern
    const link = g.selectAll<SVGLineElement, GraphLink>(".link-line")
      .data(newLinks, (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}-${d.predicate}`);

    link.exit().remove();

    const linkEnter = link.enter().append("line")
      .attr("class", "link-line")
      .attr("stroke-width", (d: any) => d.isOntologyLink ? 1 : 1.5);

    const linkMerge = linkEnter.merge(link)
      .attr("stroke", (d: any) => d.isOntologyLink ? "#a855f7" : "#475569")
      .attr("stroke-opacity", (d: any) => d.isOntologyLink ? 0.4 : 0.6)
      .attr("stroke-dasharray", (d: any) => d.isOntologyLink ? "4 2" : "none")
      .attr("marker-end", (d: any) => d.isOntologyLink ? "url(#arrow-ontology)" : "url(#arrow)");

    // --- DRAW LINK LABELS ---
    const linkLabel = g.selectAll<SVGTextElement, GraphLink>(".link-label")
      .data(newLinks, (d: any) => `${d.source.id || d.source}-${d.target.id || d.target}-${d.predicate}`);
    
    linkLabel.exit().remove();

    const linkLabelEnter = linkLabel.enter().append("text")
      .attr("class", "link-label")
      .attr("font-size", "9px")
      .attr("text-anchor", "middle")
      .attr("dy", -5);

    const linkLabelMerge = linkLabelEnter.merge(linkLabel)
      .text(d => d.predicate)
      .attr("fill", (d: any) => d.isOntologyLink ? "#c084fc" : "#94a3b8");


    // --- DRAW NODES ---
    const node = g.selectAll<SVGGElement, GraphNode>(".node-group")
      .data(newNodes, (d) => d.id);

    node.exit().transition().duration(500).attr("opacity", 0).remove();

    const nodeEnter = node.enter().append("g")
      .attr("class", "node-group")
      .attr("cursor", "grab")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onNodeClick) onNodeClick(d);
      });

    // Add shapes to enter selection
    nodeEnter.each(function(d: any) {
      const el = d3.select(this);
      if (d.type === NodeType.Class) {
        el.append("path")
          .attr("d", "M0,-20 L17.32,-10 L17.32,10 L0,20 L-17.32,10 L-17.32,-10 Z");
      } else {
        el.append("circle")
          .attr("r", 15);
      }
      el.append("text")
        .attr("x", d.type === NodeType.Class ? 24 : 22)
        .attr("y", 5)
        .attr("stroke", "none")
        .attr("font-family", "monospace")
        .attr("font-size", d.type === NodeType.Class ? "14px" : "12px");
    });

    // Merge and Update Styling for all nodes
    const nodeMerge = nodeEnter.merge(node);

    nodeMerge.each(function(d: any) {
      const el = d3.select(this);
      const isSelected = d.id === selectedNodeId;
      const isMatch = searchTerm && d.label.toLowerCase().includes(searchTerm.toLowerCase());
      const strokeColor = isSelected ? "#ffffff" : (isMatch ? "#fde047" : "#fff");
      const strokeWidth = isSelected || isMatch ? 3 : 1.5;

      if (d.type === NodeType.Class) {
        el.select("path")
          .attr("fill", "#4c1d95")
          .attr("stroke", strokeColor)
          .attr("stroke-width", strokeWidth)
          .attr("stroke-dasharray", isSelected ? "3 2" : "none");
      } else {
        el.select("circle")
          .attr("r", isSelected ? 20 : 15)
          .attr("fill", () => {
             if (isMatch) return "#b45309"; 
             switch (d.type) {
               case NodeType.Person: return "#3b82f6";
               case NodeType.Organization: return "#be185d";
               case NodeType.Location: return "#15803d";
               case NodeType.Event: return "#b91c1c";
               case NodeType.Document: return "#334155";
               default: return "#64748b"; 
             }
          })
          .attr("stroke", strokeColor)
          .attr("stroke-width", strokeWidth)
          .attr("stroke-dasharray", isSelected ? "3 2" : "none");
      }
      
      el.select("text")
        .text(d.label)
        .attr("fill", d.type === NodeType.Class ? "#e9d5ff" : "#e2e8f0")
        .attr("font-weight", d.id === selectedNodeId || d.type === NodeType.Class ? "bold" : "normal");
    });

    // Tick Function
    simulation.on("tick", () => {
      linkMerge
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabelMerge
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      nodeMerge.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
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

  }, [nodes, links, width, height, selectedNodeId, searchTerm, onNodeClick]);

  return (
    <svg 
      ref={svgRef} 
      width={width} 
      height={height} 
      className="bg-slate-900 rounded-lg border border-slate-700 shadow-inner w-full touch-none"
      style={{ cursor: 'move' }}
      onClick={() => onNodeClick && onNodeClick(null as any)} 
    />
  );
};

export default KnowledgeGraph;
