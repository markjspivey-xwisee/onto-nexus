
import { GoogleGenAI, Type } from "@google/genai";
import { GraphNode, GraphLink, NodeType, NewsArticle } from '../types';

// Helper to safely get API key
const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

// Initialize Gemini Client
const initAi = () => {
  const key = getApiKey();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
};

/**
 * Fetches recent global news relevant to situational awareness.
 * Supports a specific 'topic' to focus the intelligence gathering.
 */
export const fetchGlobalIntel = async (topic?: string): Promise<NewsArticle[]> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");

  const modelId = "gemini-3-flash-preview";
  
  const context = topic 
    ? `Focus strictly on the topic: "${topic}". Find connections to this topic globally.`
    : `Focus on: Geopolitics, Cyber Threats, Environmental Disasters, and Major Technological Shifts.`;

  const prompt = `
    Generate a situational awareness briefing for a global command center. 
    ${context}
    
    Return 4 distinct, high-priority news items. 
    If possible, ground this in real recent events (using the tools), otherwise simulate realistic scenarios based on current world context.
    
    For each item, assess a 'riskLevel' (LOW, MEDIUM, HIGH, CRITICAL).
    Include 2-3 specific semantic tags using standard ontologies (e.g., 'dcat:Dataset', 'prov:Activity', 'odrl:Policy').
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              source: { type: Type.STRING },
              riskLevel: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
              semanticTags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }
    });

    let data: any;
    try {
      data = JSON.parse(response.text || "[]");
    } catch (e) {
      console.warn("JSON parse failed for intel feed, falling back to empty array.", e);
      data = [];
    }
    
    // Ensure data is an array
    if (!Array.isArray(data)) {
      if (data && typeof data === 'object') {
        const possibleArray = Object.values(data).find(v => Array.isArray(v));
        data = possibleArray || [];
      } else {
        data = [];
      }
    }
    
    return data.map((item: any, index: number) => ({
      id: `news-${Date.now()}-${index}`,
      title: item.title || "Unknown Event",
      summary: item.summary || "No details available.",
      source: item.source || "Unknown Source",
      riskLevel: item.riskLevel || "LOW",
      semanticTags: Array.isArray(item.semanticTags) ? item.semanticTags : [],
      timestamp: new Date().toISOString(),
      url: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.[index]?.web?.uri || '#'
    }));

  } catch (error) {
    console.error("Gemini Intel Fetch Error:", error);
    return [
      {
        id: 'mock-1',
        title: 'System Offline: Neural Net Breach',
        summary: 'A localized failure in the semantic grid has caused data packet loss. Provenance chains broken.',
        source: 'Internal Sensors',
        timestamp: new Date().toISOString(),
        riskLevel: 'HIGH',
        semanticTags: ['prov:Invalidation', 'sec:Breach'],
        url: '#'
      }
    ];
  }
};

/**
 * Generates the initial Domain Ontology (T-Box) based on the topic.
 * This ensures the schema exists before instances are mapped.
 */
export const generateDomainOntology = async (topic: string): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");

  const prompt = `
    You are an Ontology Engineer. Create a high-level Domain Ontology (T-Box) for the topic: "${topic}".
    
    Return a set of Nodes representing OWL Classes (e.g., if topic is "Ocean", classes might be "Vessel", "Port", "Storm").
    Return Links representing relationships between these classes (rdfs:subClassOf, owl:disjointWith, etc).
    
    Keep it concise: 5-8 key classes max.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: [NodeType.Class] }
                }
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  predicate: { type: Type.STRING },
                  label: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    let data: any;
    try {
       data = JSON.parse(response.text || '{"nodes": [], "links": []}');
    } catch(e) {
       data = { nodes: [], links: [] };
    }
    
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const rawLinks = Array.isArray(data.links) ? data.links : [];
    const links = rawLinks.map((l: any) => ({ ...l, isOntologyLink: true }));

    return { nodes, links };
  } catch (e) {
    console.error("Domain Ontology Gen Failed", e);
    return { nodes: [], links: [] };
  }
};

/**
 * Extracts Knowledge Graph entities and triples from a text.
 * Accepts existing ontology classes to ground the extraction in the T-Box.
 */
export const extractKnowledgeGraph = async (text: string, existingClasses: string[] = []): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");

  const modelId = "gemini-3-flash-preview";
  
  const ontologyContext = existingClasses.length > 0 
    ? `Map entities to these existing OWL Classes where possible using 'rdf:type': ${existingClasses.join(', ')}.` 
    : "";

  const prompt = `
    Analyze the following intelligence text and extract a Knowledge Graph in RDF/OWL style.
    
    Text: "${text}"
    
    ${ontologyContext}
    
    Identify key entities (Person, Organization, Location, Event, Concept).
    Identify relationships between them.
    
    IMPORTANT: If you identify an entity that belongs to one of the provided Classes, create a link: { source: "EntityID", target: "ClassID", predicate: "rdf:type" }.
    
    Format as JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique CamelCase ID, e.g., UnitedNations" },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: Object.values(NodeType) }
                }
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: "ID of source node" },
                  target: { type: Type.STRING, description: "ID of target node" },
                  predicate: { type: Type.STRING, description: "e.g., prov:actedOnBehalfOf" },
                  label: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    let data: any;
    try {
      data = JSON.parse(response.text || '{"nodes": [], "links": []}');
    } catch (e) {
      console.warn("JSON parse failed for KG extraction.", e);
      data = { nodes: [], links: [] };
    }

    const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
    let links = Array.isArray(data?.links) ? data.links : [];

    // --- HEURISTIC LINKING START ---
    // If a node doesn't have an explicit link, attempt to link it to a parent Class based on its type.
    // This solves the "orphan node" problem.
    nodes.forEach((node: GraphNode) => {
      // Don't link classes to themselves or other classes in this heuristics step
      if (node.type === NodeType.Class) return;

      // Check if this node already has an outgoing rdf:type link
      const hasTypeLink = links.some((l: any) => l.source === node.id && l.predicate === 'rdf:type');
      
      if (!hasTypeLink) {
        // Try to find a matching Class in existingClasses or standard types
        // The node.type itself (e.g. "Person") is usually a valid Class ID in our schema
        const targetClassId = node.type;
        
        // We link it if it's a known type
        if (targetClassId) {
            links.push({
                source: node.id,
                target: targetClassId,
                predicate: 'rdf:type',
                label: 'type',
                isOntologyLink: true
            });
        }
      }
    });
    // --- HEURISTIC LINKING END ---

    // Post-process links to identify ontology links
    links = links.map((l: any) => ({
       ...l,
       isOntologyLink: l.predicate === 'rdf:type' || l.predicate === 'rdfs:subClassOf' || existingClasses.includes(l.target)
    }));

    return { nodes, links };

  } catch (error) {
    console.error("Gemini KG Extraction Error:", error);
    return { nodes: [], links: [] };
  }
};

/**
 * Generates the T-Box (Ontology Layer) for the current graph.
 * Creates Class nodes and links them to existing A-Box nodes via rdf:type.
 */
export const generateOntologyLayer = async (currentNodes: GraphNode[]): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");
  
  if (currentNodes.length === 0) return { nodes: [], links: [] };

  // Only take a sample if too large to avoid token limits
  const sampleNodes = currentNodes.slice(0, 30);
  const nodeSummary = sampleNodes.map(n => `${n.id} (${n.type})`).join(", ");

  const prompt = `
    Given these Knowledge Graph instances (A-Box):
    [${nodeSummary}]

    Generate the Ontology Layer (T-Box):
    1. Identify the high-level OWL Classes for these instances (e.g. 'GeopoliticalEntity', 'NonStateActor', 'CyberIncident').
    2. Create relationships for 'rdf:type' linking the instance ID to the Class ID.
    3. Create relationships between Classes if obvious (e.g. 'CyberIncident' rdfs:subClassOf 'SecurityEvent').

    Return as JSON nodes/links.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: [NodeType.Class] } // Force type Class
                }
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  predicate: { type: Type.STRING },
                  label: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    
    let data: any;
    try {
       data = JSON.parse(response.text || '{"nodes": [], "links": []}');
    } catch(e) {
       data = { nodes: [], links: [] };
    }

    const rawLinks = Array.isArray(data.links) ? data.links : [];
    // Mark links as ontology links for styling
    const links = rawLinks.map((l: any) => ({ ...l, isOntologyLink: true }));
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];

    return { nodes, links };

  } catch (e) {
    console.error("Ontology generation failed", e);
    return { nodes: [], links: [] };
  }
};

/**
 * SHACL Pattern Search Agent
 * Scans the web for entities matching a specific SHACL shape/rule.
 */
export const performShaclScan = async (shaclDescription: string): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");

  const prompt = `
    You are a SHACL Pattern Recognition Agent.
    
    User Pattern Request: "${shaclDescription}"
    
    1. Search the web to find REAL entities that match this description.
    2. Model the findings as a Knowledge Graph.
    3. CRITICAL: Ensure you find the entities (Nodes) and how they relate (Links) to satisfy the pattern.
    4. CRITICAL: Do not create orphaned nodes. If you find a 'Person', link them to their 'Organization' or 'Location'. If you find an 'Event', link it to 'Participants'.
    5. Always attempt to link new entities to high-level classes like 'Person', 'Organization', or 'Location' via 'rdf:type' if no other specific parent exists.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: Object.values(NodeType) }
                }
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  predicate: { type: Type.STRING },
                  label: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    let data: any;
    try {
        data = JSON.parse(response.text || '{"nodes": [], "links": []}');
    } catch(e) {
        data = { nodes: [], links: [] };
    }
    
    const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
    let links = Array.isArray(data?.links) ? data.links : [];

    // --- HEURISTIC LINKING FOR SHACL ---
    // SHACL often produces lists of entities. We must tether them to the graph.
    nodes.forEach((node: GraphNode) => {
      if (node.type === NodeType.Class) return;
      
      const hasTypeLink = links.some((l: any) => l.source === node.id && l.predicate === 'rdf:type');
      
      if (!hasTypeLink) {
        // Automatically link to its type Class
        links.push({
            source: node.id,
            target: node.type, // e.g., "Organization"
            predicate: 'rdf:type',
            label: 'type',
            isOntologyLink: true
        });
      }
    });

    return { nodes, links };

  } catch (e) {
    console.error("SHACL Scan failed", e);
    return { nodes: [], links: [] };
  }
};

/**
 * Generates a strategic situation report using Judea Pearl's Causal Framework.
 */
export const generateSituationReport = async (nodes: GraphNode[], links: GraphLink[]): Promise<string> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");

  const modelId = "gemini-3-flash-preview";
  
  const graphSummary = {
    entities: nodes.map(n => `${n.label} (${n.type})`),
    relationships: links.map(l => `${typeof l.source === 'object' ? (l.source as any).id : l.source} ${l.predicate} ${typeof l.target === 'object' ? (l.target as any).id : l.target}`)
  };

  const prompt = `
    You are a Strategic AI Advisor in a Global Command Center.
    Analyze the following Knowledge Graph structure representing current world events:
    
    ${JSON.stringify(graphSummary, null, 2)}

    Provide a "Causal Situation Report" (SitRep) using Judea Pearl's Ladder of Causation.
    
    Structure the response exactly as follows:
    
    ### 1. ASSOCIATIONAL ANALYSIS (Seeing)
    [Identify the central cluster and correlations in the data.]

    ### 2. INTERVENTION (Doing)
    [Select one key node X. Predict the outcome if we intervene: "do(X = stopped)". How does this propagate?]

    ### 3. COUNTERFACTUALS (Imagining)
    [Select a recent event node Y. Ask: "Had Y not occurred, what likely would have been the state of node Z?" (Probability of Necessity/Sufficiency)]
    
    ### 4. EXECUTIVE RECOMMENDATION
    [One sentence actionable command.]
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "Causal analysis inconclusive.";
  } catch (error) {
    console.error("SitRep Gen Error:", error);
    return "Communication with Causal Engine interrupted.";
  }
};
