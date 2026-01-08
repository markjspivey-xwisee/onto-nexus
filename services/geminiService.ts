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
 * Extracts Knowledge Graph entities and triples from a text.
 */
export const extractKnowledgeGraph = async (text: string): Promise<{ nodes: GraphNode[], links: GraphLink[] }> => {
  const ai = initAi();
  if (!ai) throw new Error("API Key not found");

  const modelId = "gemini-3-flash-preview";
  const prompt = `
    Analyze the following intelligence text and extract a Knowledge Graph in RDF/OWL style.
    
    Text: "${text}"
    
    Identify key entities (Person, Organization, Location, Event, Concept).
    Identify relationships between them using standard ontology predicates where possible (e.g., foaf:knows, org:memberOf, prov:wasStartedBy, spatial:locatedIn).
    
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
    const links = Array.isArray(data?.links) ? data.links : [];

    return { nodes, links };

  } catch (error) {
    console.error("Gemini KG Extraction Error:", error);
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