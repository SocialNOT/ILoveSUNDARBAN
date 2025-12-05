import React from 'react';
import { SyllabusData } from '../types';
import Logo from './Logo';

interface SyllabusViewProps {
  data: SyllabusData;
  onQuerySelect: (query: string) => void;
}

const SyllabusView: React.FC<SyllabusViewProps> = ({ data, onQuerySelect }) => {
  const hasContent = data.primary_sources_en.length > 0 || data.primary_sources_bn.length > 0 || data.secondary_sources.length > 0;

  return (
    <div className="flex flex-col h-full bg-skin-fill-panel relative">
      <div className="p-4 border-b border-skin-border flex-shrink-0 bg-skin-fill-panel/50 backdrop-blur-sm z-10">
        <h2 className="text-lg font-serif font-bold text-skin-accent break-words uppercase tracking-widest">{data.project_title}</h2>
        <p className="text-skin-muted text-xs font-mono mt-1 break-words opacity-80">{data.core_concept !== 'Unconfigured' && 'CORE CONCEPT: '}{data.core_concept}</p>
      </div>

      {/* Added pb-32 to ensure scrolling clears the mobile nav bar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-32 md:pb-4">
        {!hasContent ? (
           <div className="flex flex-col items-center justify-center py-20 opacity-50">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-skin-muted"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
               <p className="text-sm font-mono uppercase tracking-widest text-skin-muted text-center">No Sources Loaded</p>
           </div>
        ) : (
          <>
            {/* Primary Sources EN */}
            {data.primary_sources_en.length > 0 && (
              <section className="animate-fade-in" style={{ animationDelay: '0ms' }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-skin-muted mb-3 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-skin-accent"></span>
                  Primary Knowledge
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {data.primary_sources_en.map((source, idx) => (
                    <div 
                      key={idx} 
                      className="group cursor-pointer p-3 rounded-xl bg-skin-fill-element border border-skin-border hover:border-skin-accent transition-all shadow-sm hover:shadow-md relative overflow-hidden"
                      onClick={() => onQuerySelect(`Analyze the content of "${source.text}"${source.concept_focus ? ` focusing on ${source.concept_focus}` : ''}.`)}
                      title="Click to analyze this source"
                    >
                      <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-skin-base group-hover:text-skin-accent transition-colors leading-tight break-words">
                            {source.text}
                          </p>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 text-skin-accent transition-opacity shrink-0 transform translate-x-2 group-hover:translate-x-0"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                      </div>
                      {source.concept_focus && <p className="text-xs text-skin-muted mt-2 font-mono break-words border-t border-skin-border/30 pt-2 opacity-90">{source.concept_focus}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Other Sources */}
            {data.primary_sources_bn.length > 0 && (
              <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-skin-muted mb-3 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-skin-accent"></span>
                  Regional Sources
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {data.primary_sources_bn.map((source, idx) => (
                    <div 
                      key={idx} 
                      className="group cursor-pointer p-3 rounded-xl bg-skin-fill-element border border-skin-border hover:border-skin-accent transition-all shadow-sm"
                      onClick={() => onQuerySelect(`Explain the significance of "${source.text}" by ${source.author}.`)}
                    >
                       <p className="text-sm font-semibold text-skin-base group-hover:text-skin-accent transition-colors break-words">
                          {source.text}
                       </p>
                      <p className="text-xs text-skin-muted mt-1 font-mono">{source.author}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Secondary Sources */}
            {data.secondary_sources.length > 0 && (
              <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-skin-muted mb-3 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-skin-accent"></span>
                  Scholarly References
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {data.secondary_sources.map((source, idx) => (
                    <div 
                      key={idx} 
                      className="group cursor-pointer p-3 rounded-xl bg-skin-fill-element border border-skin-border hover:border-skin-accent transition-all shadow-sm"
                      onClick={() => onQuerySelect(`Summarize ${source.author}'s contributions to '${source.focus}'.`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-skin-accent group-hover:text-skin-base transition-colors underline decoration-dotted decoration-skin-muted underline-offset-4 break-words">
                          {source.author}
                        </p>
                      </div>
                      <p className="text-xs text-skin-muted font-mono break-words opacity-90">{source.focus}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Key Terms - With Glowing Animation */}
            {data.key_terms.length > 0 && (
              <section className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                 <h3 className="text-xs font-bold uppercase tracking-widest text-skin-muted mb-3 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-skin-accent"></span>
                  Key Terminology
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.key_terms.map((term, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => onQuerySelect(`Define "${term}".`)}
                      className="px-3 py-1.5 bg-skin-fill-element border border-skin-border text-xs text-skin-base font-mono rounded-lg hover:border-skin-accent hover:text-skin-accent transition-all cursor-pointer text-left break-words animate-border-glow shadow-sm"
                      title={`Ask for definition of ${term}`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        
        {/* Footer Area */}
        <div className="mt-8 pt-8 border-t border-skin-border flex flex-col items-center text-center opacity-60 hover:opacity-100 transition-opacity pb-8 md:pb-4">
           <Logo variant="footer" />
           <div className="flex flex-col gap-1 text-[10px] font-mono text-skin-muted">
               <a href="mailto:admin@ilovesundarban.com" className="hover:text-skin-accent transition-colors">admin@ilovesundarban.com</a>
               <a href="tel:+917998300083" className="hover:text-skin-accent transition-colors">+91 7998300083</a>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SyllabusView;