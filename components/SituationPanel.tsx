import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Radio, Users, ShieldAlert, Terminal } from 'lucide-react';
import { Alert } from '../types';

interface SituationPanelProps {
  alerts: Alert[];
  onSendAlert: (msg: string) => void;
}

const SituationPanel: React.FC<SituationPanelProps> = ({ alerts, onSendAlert }) => {
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendAlert(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 text-slate-300">
      
      {/* Header: Group Status */}
      <div className="p-4 border-b border-slate-700 bg-slate-950">
        <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
          <Users size={16} /> Shared Awareness
        </h3>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Online Agents</span>
            <span className="text-green-400">4 / 5</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Secure Channel</span>
            <span className="text-blue-400 flex items-center gap-1"><Radio size={12} className="animate-pulse"/> ENCRYPTED</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Ontology Sync</span>
            <span className="text-purple-400">SHACL VALIDATED</span>
          </div>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {alerts.length === 0 && <div className="text-slate-600 italic text-center mt-10">No active alerts. Quiet on the western front.</div>}
        {alerts.map(alert => (
          <div key={alert.id} className={`p-3 rounded border ${
            alert.severity === 'error' ? 'bg-red-950/30 border-red-800 text-red-300' :
            alert.severity === 'warning' ? 'bg-amber-950/30 border-amber-800 text-amber-300' :
            'bg-slate-800 border-slate-700 text-slate-300'
          }`}>
            <div className="flex justify-between items-start mb-1 opacity-70">
              <span className="font-bold">[{alert.sender}]</span>
              <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
            <p>{alert.message}</p>
          </div>
        ))}
      </div>

      {/* Command Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-950">
        <form onSubmit={handleSend} className="flex gap-2">
          <div className="relative flex-1">
            <Terminal size={14} className="absolute left-2 top-3 text-slate-500" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Broadcast command..."
              className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-2 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200 font-mono"
            />
          </div>
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded transition-colors"
          >
            <ShieldAlert size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SituationPanel;
