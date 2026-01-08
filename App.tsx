
import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, 
  Activity, 
  Database, 
  Share2, 
  Cpu, 
  Layers, 
  FileJson, 
  RefreshCw,
  Search,
  Download,
  BrainCircuit,
  X,
  ExternalLink,
  Target,
  Zap
} from 'lucide-react';
import KnowledgeGraph from './components/KnowledgeGraph';
import SituationPanel from './components/SituationPanel';
import { fetchGlobalIntel, extractKnowledgeGraph, generateSituationReport } from './services/geminiService';
import { NewsArticle, KnowledgeGraphData, Alert, ONTOLOGY_PREFIXES, GraphNode } from './types';

const App: React.FC = () => {
  // State
  const [topic, setTopic] = useState('');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  
  // Track which articles are currently being processed
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'graph' | 'ontology'>('graph');
  
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sitRep, setSitRep] = useState<string | null>(null);
  const [generatingSitRep, setGeneratingSitRep] = useState(false);

  // Initial Data Load
  useEffect(() => {
    loadIntel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers
  const loadIntel = async (customTopic?: string) => {
    setLoading(true);
    setProcessingIds(new Set()); // Reset processing state
    
    try {
      const news = await fetchGlobalIntel(customTopic || topic);
      setArticles(news);
      addAlert('System', `Intel feed updated. ${customTopic ? `Topic: ${customTopic}` : 'Global scan.'}`, 'info');
      
      // Real-time Background Mapping Queue
      // We process them one by one with a slight delay to look cool and avoid rate limits
      processBackgroundQueue(news);

    } catch (e) {
      console.error(e);
      addAlert('System', 'Failed to retrieve global feed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processBackgroundQueue = async (items: NewsArticle[]) => {
    for (let i = 0; i < items.length; i++) {
      const article = items[i];
      // Small delay for visual effect
      await new Promise(r => setTimeout(r, i === 0 ? 0 : 2000)); 
      
      // Trigger analysis
      analyzeArticle(article);
    }
  };

  const analyzeArticle = async (article: NewsArticle) => {
    // Add to processing set
    setProcessingIds(prev => new Set(prev).add(article.id));
    
    try {
      const kg = await extractKnowledgeGraph(article.summary);
      
      if (!kg || !kg.nodes || !kg.links) {
        throw new Error("Received malformed knowledge graph data");
      }

      // Merge new nodes/links
      setGraphData(prev => {
        const newNodes = kg.nodes.filter(n => !prev.nodes.find(pn => pn.id === n.id));
        // Add coordinates to new nodes to prevent them from spawning at (0,0) and exploding
        // random position near center
        newNodes.forEach(n => {
           n.x = 400 + (Math.random() - 0.5) * 50;
           n.y = 300 + (Math.random() - 0.5) * 50;
        });

        return {
          nodes: [...prev.nodes, ...newNodes],
          links: [...prev.links, ...kg.links.map(l => ({...l}))]
        };
      });
      addAlert('OntologyAgent', `Mapped: ${article.title.substring(0, 20)}...`, 'info');
    } catch (e) {
      console.error(e);
      // addAlert('System', 'Semantic extraction failed.', 'error'); // Keep quiet on failure to not spam
    } finally {
      // Remove from processing set
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(article.id);
        return next;
      });
    }
  };

  const handleGenerateSitRep = async () => {
    if (graphData.nodes.length === 0) return;
    setGeneratingSitRep(true);
    setSitRep(null);
    try {
      const report = await generateSituationReport(graphData.nodes, graphData.links);
      setSitRep(report);
      addAlert('Command', 'Causal Analysis & Counterfactuals generated.', 'info');
    } catch (e) {
      addAlert('System', 'Failed to generate SitRep.', 'error');
    } finally {
      setGeneratingSitRep(false);
    }
  };

  const handleExportJSONLD = () => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": graphData.nodes.map(node => ({
        "@id": node.id,
        "@type": node.type,
        "name": node.label,
        ...graphData.links
          .filter(link => typeof link.source === 'object' ? (link.source as any).id === node.id : link.source === node.id)
          .reduce((acc, link) => ({...acc, [link.predicate]: typeof link.target === 'object' ? (link.target as any).id : link.target }), {})
      }))
    };
    
    const blob = new Blob([JSON.stringify(jsonLd, null, 2)], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ontonexus-graph-${Date.now()}.jsonld`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addAlert('System', 'Knowledge Graph exported as JSON-LD.', 'info');
  };

  const addAlert = (sender: string, message: string, severity: 'info' | 'warning' | 'error') => {
    setAlerts(prev => [
      { id: Date.now().toString() + Math.random(), sender, message, timestamp: new Date().toISOString(), severity },
      ...prev
    ]);
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadIntel(topic);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* Left Sidebar: Ontology & Controls */}
      <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-700 bg-slate-950">
          <h1 className="text-lg font-bold text-blue-400 flex items-center gap-2">
            <Globe className="text-blue-500" /> ONTO-NEXUS
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">v3.6.0 [CAUSAL ENGINE]</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <Database size={12} /> Active Namespaces
          </h2>
          <div className="space-y-2">
            {ONTOLOGY_PREFIXES.map((ont) => (
              <div key={ont.prefix} className="group p-2 rounded bg-slate-800/50 hover:bg-slate-800 border border-transparent hover:border-slate-600 transition-all cursor-help relative">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-purple-400">{ont.prefix}:</span>
                  <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{ont.uri}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-700 pt-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
               System Metrics
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800 p-2 rounded text-center">
                <div className="text-xs text-slate-500">Nodes</div>
                <div className="text-lg font-mono font-bold text-white">{graphData.nodes.length}</div>
              </div>
              <div className="bg-slate-800 p-2 rounded text-center">
                <div className="text-xs text-slate-500">Triples</div>
                <div className="text-lg font-mono font-bold text-white">{graphData.links.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Top Bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${activeTab === 'graph' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Share2 size={16} /> Knowledge Graph
            </button>
            <button 
              onClick={() => setActiveTab('ontology')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${activeTab === 'ontology' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <FileJson size={16} /> Data Schema
            </button>
          </div>
          
          {/* Mission Topic Input */}
          <form onSubmit={handleTopicSubmit} className="flex-1 max-w-md mx-4 relative hidden sm:block">
            <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Set Mission Topic (e.g. 'South China Sea')..." 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md py-1.5 pl-9 pr-3 text-sm text-slate-200 focus:border-blue-500 focus:outline-none placeholder:text-slate-600 font-mono"
            />
          </form>

          <div className="flex items-center gap-3">
             <button 
                onClick={handleExportJSONLD}
                title="Export as JSON-LD"
                className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-green-400 transition-colors"
             >
                <Download size={18} />
             </button>
             {processingIds.size > 0 && <span className="text-xs text-amber-400 animate-pulse flex items-center gap-1"><Cpu size={12}/> MAPPING ({processingIds.size})...</span>}
             <button onClick={() => loadIntel(topic)} disabled={loading} className="p-2 hover:bg-slate-800 rounded text-slate-400">
               <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
             </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden relative">
          
          {/* Feed Column */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg flex flex-col h-full lg:col-span-1">
            <div className="p-3 border-b border-slate-700 bg-slate-950 flex justify-between items-center">
              <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Activity size={16} className="text-red-500" /> INTEL FEED
              </h2>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">LIVE</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {articles.map(article => (
                <div key={article.id} className="bg-slate-950 border border-slate-800 rounded p-3 hover:border-slate-600 transition-colors group relative overflow-hidden">
                  {/* Processing Indicator */}
                  {processingIds.has(article.id) && (
                     <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 animate-pulse"></div>
                  )}
                  
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-1.5 rounded ${
                      article.riskLevel === 'CRITICAL' ? 'bg-red-600 text-white' :
                      article.riskLevel === 'HIGH' ? 'bg-orange-600 text-white' :
                      'bg-blue-900 text-blue-200'
                    }`}>
                      {article.riskLevel}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(article.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 mb-1 leading-snug">{article.title}</h3>
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{article.summary}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {article.semanticTags.map(tag => (
                      <span key={tag} className="text-[9px] text-purple-300 bg-purple-900/30 px-1 rounded border border-purple-900/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                     <button 
                       disabled={true}
                       className={`flex-1 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors border ${
                         processingIds.has(article.id) 
                            ? "bg-amber-950/30 text-amber-500 border-amber-900" 
                            : "bg-slate-900 text-green-500 border-slate-800"
                       }`}
                     >
                       {processingIds.has(article.id) ? (
                           <><Cpu size={12} className="animate-spin" /> MAPPING...</>
                       ) : (
                           <><Layers size={12} /> MAPPED</>
                       )}
                     </button>
                     {(() => {
                        const hasUrl = article.url && article.url !== '#';
                        const targetUrl = hasUrl ? article.url : `https://www.google.com/search?q=${encodeURIComponent(article.title + " news")}`;
                        return (
                          <a 
                            href={targetUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            title={hasUrl ? "Read Source" : "Verify on Google"}
                            className="px-2 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center border border-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            {hasUrl ? <ExternalLink size={12} /> : <Search size={12} />}
                          </a>
                        );
                     })()}
                  </div>
                </div>
              ))}
              {articles.length === 0 && !loading && (
                <div className="text-center p-8 text-slate-600">
                  <p>No signals detected.</p>
                  <p className="text-xs mt-2">Enter a topic above or refresh.</p>
                </div>
              )}
            </div>
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden relative">
            {activeTab === 'graph' ? (
              <div className="flex-1 relative w-full h-full bg-slate-950">
                 {/* Graph Overlay UI */}
                 <div className="absolute top-4 left-4 z-10 pointer-events-none flex gap-2">
                    <div className="bg-black/50 backdrop-blur p-2 rounded border border-slate-800 text-xs text-slate-300 pointer-events-auto">
                      <p className="font-bold mb-1">GRAPH VISUALIZATION</p>
                      <p className="text-slate-500">Real-time Causal Mapping Active</p>
                    </div>
                    <button 
                      onClick={handleGenerateSitRep}
                      disabled={generatingSitRep || graphData.nodes.length === 0}
                      className="pointer-events-auto bg-blue-900/80 backdrop-blur hover:bg-blue-800 border border-blue-700 text-blue-200 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                    >
                      <BrainCircuit size={14} className={generatingSitRep ? "animate-spin" : ""} />
                      {generatingSitRep ? "RUNNING CAUSAL SIMULATION..." : "CAUSAL SITREP"}
                    </button>
                 </div>
                 
                 {/* SitRep Modal Overlay */}
                 {sitRep && (
                   <div className="absolute top-16 left-4 right-4 bottom-4 z-20 bg-slate-900/95 backdrop-blur-md border border-blue-800 rounded p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 overflow-y-auto flex flex-col">
                     <div className="flex justify-between items-start mb-4 border-b border-blue-900 pb-4">
                       <h3 className="font-bold text-blue-400 flex items-center gap-2 text-lg">
                           <BrainCircuit size={20}/> CAUSAL SITUATION REPORT
                       </h3>
                       <button onClick={() => setSitRep(null)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded"><X size={20}/></button>
                     </div>
                     <div className="flex-1 overflow-y-auto">
                        <div className="prose prose-invert prose-sm max-w-none font-mono whitespace-pre-line">
                           {sitRep}
                        </div>
                     </div>
                     <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                       <span>FRAMEWORK: JUDEA PEARL (LADDER OF CAUSATION)</span>
                       <span>GENERATED BY GEMINI-3-FLASH</span>
                     </div>
                   </div>
                 )}

                 {/* Node Inspector Overlay */}
                 {selectedNode && (
                   <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur border border-slate-600 rounded p-4 w-64 shadow-xl">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold bg-slate-700 px-1 rounded text-slate-300">{selectedNode.type.toUpperCase()}</span>
                        <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white"><X size={14}/></button>
                      </div>
                      <h3 className="font-bold text-lg text-white mb-2">{selectedNode.label}</h3>
                      <div className="text-xs text-slate-400 mb-2 font-mono">{selectedNode.id}</div>
                      
                      <div className="border-t border-slate-700 pt-2 mt-2">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Connections</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {graphData.links
                            .filter(l => (typeof l.source === 'object' ? (l.source as any).id : l.source) === selectedNode.id)
                            .map((l, i) => (
                              <div key={i} className="text-[11px] text-slate-300">
                                <span className="text-purple-400">→ {l.predicate}</span> {(l.target as any).label || l.target}
                              </div>
                            ))
                          }
                          {graphData.links
                            .filter(l => (typeof l.target === 'object' ? (l.target as any).id : l.target) === selectedNode.id)
                            .map((l, i) => (
                              <div key={i} className="text-[11px] text-slate-300">
                                <span className="text-green-400">← {l.predicate}</span> {(l.source as any).label || l.source}
                              </div>
                            ))
                          }
                          {graphData.links.filter(l => (typeof l.source === 'object' ? (l.source as any).id : l.source) === selectedNode.id || (typeof l.target === 'object' ? (l.target as any).id : l.target) === selectedNode.id).length === 0 && 
                            <span className="text-slate-600 italic text-[11px]">No active links</span>
                          }
                        </div>
                      </div>
                   </div>
                 )}
                 
                 <KnowledgeGraph 
                   nodes={graphData.nodes} 
                   links={graphData.links} 
                   width={800} 
                   height={600}
                   onNodeClick={setSelectedNode}
                   selectedNodeId={selectedNode?.id}
                 />
              </div>
            ) : (
              <div className="flex-1 p-4 overflow-auto bg-slate-950 font-mono text-xs text-green-400">
                <pre>{JSON.stringify(graphData, null, 2)}</pre>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Right Sidebar: Shared Awareness */}
      <div className="w-80 h-full hidden xl:block">
        <SituationPanel 
          alerts={alerts} 
          onSendAlert={(msg) => addAlert('You', msg, 'warning')} 
        />
      </div>

    </div>
  );
};

export default App;
