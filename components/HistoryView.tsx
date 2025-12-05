import React from 'react';
import { ChatMessage } from '../types';
import Logo from './Logo';

interface HistoryViewProps {
  messages: ChatMessage[];
  onHistorySelect: (query: string) => void;
  useThinking: boolean;
}

const HistoryView: React.FC<HistoryViewProps> = ({ messages, onHistorySelect, useThinking }) => {
  // Filter only completed user queries for the history list
  const userQueries = messages.filter(m => m.role === 'user');
  // FIX: Dynamically determine model name based on thinking state
  const modelName = useThinking ? 'Gemini 3 Pro Preview' : 'Gemini 2.5 Flash';

  return (
    <div className="flex flex-col h-full bg-skin-fill-panel relative">
      <div className="p-4 border-b border-skin-border flex-shrink-0 bg-skin-fill-panel/50 backdrop-blur-sm z-10">
        <h2 className="text-lg font-serif font-bold text-skin-accent break-words uppercase tracking-widest">Audit Module</h2>
        <p className="text-skin-muted text-xs font-mono mt-1 opacity-80">SESSION LOGS & STATUS</p>
      </div>

      {/* Added pb-32 to ensure scrolling clears the mobile nav bar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-32 md:pb-4">
        {userQueries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-skin-muted"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
             <p className="text-sm font-mono uppercase tracking-widest text-skin-muted text-center">No Audit Entries</p>
          </div>
        ) : (
          <div className="space-y-3">
            {userQueries.map((msg, idx) => (
              <div 
                  key={msg.id} 
                  className="group cursor-pointer p-3 rounded-xl bg-skin-fill-element border border-skin-border hover:border-skin-accent transition-all shadow-sm animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => onHistorySelect(msg.text)}
                  title="Re-run this inquiry"
              >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-skin-muted bg-skin-fill-panel px-2 py-0.5 rounded border border-skin-border">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-skin-accent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <p className="text-xs font-medium text-skin-base truncate group-hover:text-skin-accent transition-colors font-sans leading-relaxed">
                  {msg.text}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-skin-border">
          <div className="bg-skin-fill-element border border-skin-border rounded-xl p-4">
              <h4 className="text-xs font-bold text-skin-accent uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-skin-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-skin-accent"></span>
                  </span>
                  System Status
              </h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] font-mono text-skin-muted">
                <span>Model Engine:</span> <span className="text-skin-base text-right">{modelName}</span>
                <span>Context Window:</span> <span className="text-skin-base text-right">Active</span>
                <span>RAG Status:</span> <span className="text-skin-base text-right">Online</span>
                <span>Security:</span> <span className="text-skin-base text-right">Standard</span>
              </div>
          </div>
        </div>

         {/* Footer */}
         <div className="mt-8 pt-8 border-t border-skin-border flex flex-col items-center text-center opacity-60 hover:opacity-100 transition-opacity pb-8 md:pb-4">
             <Logo variant="footer" />
             <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-skin-accent mb-2">
               Coded by Rajib Singh
             </p>
             <div className="flex gap-4 text-[11px] font-mono text-skin-muted">
               <a href="mailto:admin@ilovesundarban.com" className="hover:text-skin-accent transition-colors">Email</a>
               <span className="text-skin-border">|</span>
               <a href="tel:+917998300083" className="hover:text-skin-accent transition-colors">Call</a>
               <span className="text-skin-border">|</span>
               <a href="https://twitter.com/SocialNOT" target="_blank" rel="noopener noreferrer" className="hover:text-skin-accent transition-colors">Twitter</a>
             </div>
          </div>
      </div>
    </div>
  );
};

export default HistoryView;