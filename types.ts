

// Ontology and Graph Types

export enum NodeType {
  Person = 'Person',
  Organization = 'Organization',
  Location = 'Location',
  Event = 'Event',
  Concept = 'Concept',
  Document = 'Document', // e.g., NewsArticle
  Artifact = 'Artifact',
  Class = 'Class' // T-Box Ontology Node
}

export interface GraphNode {
  id: string; // URI or unique ID
  label: string;
  type: NodeType;
  properties?: Record<string, string | number>;
  // For D3
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode; // ID or Node object (after D3 processing)
  target: string | GraphNode;
  predicate: string; // e.g., prov:wasDerivedFrom, schema:organizer
  label: string; // Readable label for the predicate
  isOntologyLink?: boolean; // True if this is an rdf:type or subclassOf link
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  url?: string;
  semanticTags: string[]; // e.g., "dcat:Dataset", "prov:Entity"
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface OntologyPrefix {
  prefix: string;
  uri: string;
  description: string;
}

export const ONTOLOGY_PREFIXES: OntologyPrefix[] = [
  { prefix: 'rdf', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', description: 'Resource Description Framework' },
  { prefix: 'owl', uri: 'http://www.w3.org/2002/07/owl#', description: 'Web Ontology Language' },
  { prefix: 'shacl', uri: 'http://www.w3.org/ns/shacl#', description: 'Shapes Constraint Language' },
  { prefix: 'prov', uri: 'http://www.w3.org/ns/prov#', description: 'Provenance Ontology' },
  { prefix: 'dcat', uri: 'http://www.w3.org/ns/dcat#', description: 'Data Catalog Vocabulary' },
  { prefix: 'odrl', uri: 'http://www.w3.org/ns/odrl/2/', description: 'Open Digital Rights Language' },
  { prefix: 'hydra', uri: 'http://www.w3.org/ns/hydra/core#', description: 'Hydra Core Vocabulary' },
];

export interface Alert {
  id: string;
  message: string;
  timestamp: string;
  sender: string; // e.g., "Agent Smith" or "System"
  severity: 'info' | 'warning' | 'error';
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ShaclPattern {
  name: string;
  description: string;
  targetClass: string; // e.g. "Organization"
  rules: string[]; // e.g. "Must have relation to SanctionedCountry"
}