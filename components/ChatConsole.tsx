/*
 * SAMSAYA AI BOILERPLATE
 * An Initiative of I💚Sundarban
 * Coded by Rajib Singh
 * Contact: admin@ilovesundarban.com | +91 7998300083
 */

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, Attachment, SyllabusData } from '../types';
import { streamChatResponse, transcribeAudio, generateSpeech, decodeAudioData, translateText } from '../services/geminiService';

interface ChatConsoleProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  requestedQuery?: string;
  onQueryHandled?: () => void;
  persona: string;
  knowledgeBase: SyllabusData;
  onNewChat?: () => void;
  // FIX: Added props for lifted state
  useThinking: boolean;
  setUseThinking: React.Dispatch<React.SetStateAction<boolean>>;
}

// NEW: Static starters to match the UI screenshot
const suggestions = [
    'What exactly is "Mouli (Honey Collector)"?',
    'Why is "Cyclone Amphan" important?',
    'How does "Salinity Intrusion" relate to your mission?',
    'How do I configure my own agent?',
    'Explain how to upload custom knowledge.'
];

// Moved outside component to prevent re-renders
const HERO_STORIES = [
    {
        title: "The Digital Root",
        text: "Just as mangroves protect the land, this technology protects human knowledge. Resilient, Adaptable, and Open Source.",
        icon: "🌿",
        theme: "from-emerald-500/20 to-green-500/20"
    },
    {
        title: "The Scholar's Engine",
        text: "Unlocking the potential of Sundarban's students through open AI access. Research, learn, and grow without boundaries.",
        icon: "🎓",
        theme: "from-blue-500/20 to-cyan-500/20"
    },
    {
        title: "The Traveler's Compass",
        text: "From the silent creeks of Sajnekhali to the canopy walks of Dobanki. Plan your mystic journey into the wild.",
        icon: "🐯",
        theme: "from-amber-500/20 to-orange-500/20"
    }
];

const ChatConsole: React.FC<ChatConsoleProps> = ({ messages, setMessages, requestedQuery, onQueryHandled, persona, knowledgeBase, onNewChat, useThinking, setUseThinking }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // Toggles
  // const [useThinking, setUseThinking] = useState(false); // FIX: State is lifted to App.tsx
  const [useSearch, setUseSearch] = useState(false);
  const [searchFocus, setSearchFocus] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  // Animation State for Empty Screen Headings
  const [storyIndex, setStoryIndex] = useState(2); // Default to Traveler's Compass

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>('audio/webm');

  useEffect(() => {
    const storyInterval = setInterval(() => {
      setStoryIndex((prev) => (prev + 1) % HERO_STORIES.length);
    }, 5000);
    return () => clearInterval(storyInterval);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (requestedQuery && !isLoading && onQueryHandled) {
      executeMessage(requestedQuery, []);
      onQueryHandled();
    }
  }, [requestedQuery]);

  const executeMessage = async (text: string, msgAttachments: Attachment[]) => {
    const cleanText = text.replace(/[*🚀🧠☁️🐯❤️📚🌿]/g, '').trim(); 
    
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: cleanText,
      timestamp: new Date(),
      attachments: msgAttachments
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setAttachments([]);

    const modelMsgId = crypto.randomUUID();
    const modelMsg: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, modelMsg]);

    try {
      await streamChatResponse(
        messages, 
        cleanText, 
        msgAttachments,
        { useThinking, useSearch, searchFocus: useSearch ? searchFocus : undefined },
        persona,
        knowledgeBase,
        (chunkText) => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === modelMsgId ? { ...msg, text: chunkText } : msg
            )
          );
        }
      );
    } catch (error) {
      setMessages(prev => 
        prev.map(msg => 
            msg.id === modelMsgId 
            ? { ...msg, text: "[System Error: Unable to query the repository. Verify API Key in Settings and connection.]", isStreaming: false } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages(prev => 
        prev.map(msg => 
            msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    executeMessage(input, attachments);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- ACTIONS ---
  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const handleShare = (text: string) => {
      if (navigator.share) {
          navigator.share({ text: text });
      } else {
          handleCopy(text);
          alert("Copied to clipboard");
      }
  };

  const handleTranslate = async (msgId: string, text: string, currentTranslation: any) => {
      if (currentTranslation?.active) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translation: { ...currentTranslation, active: false } } : m));
          return;
      }
      if (currentTranslation?.text) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translation: { ...currentTranslation, active: true } } : m));
          return;
      }
      try {
          const translated = await translateText(text);
          setMessages(prev => prev.map(m => m.id === msgId ? { 
              ...m, 
              translation: { text: translated, lang: 'auto', active: true } 
          } : m));
      } catch (e) {
          console.error("Translation failed", e);
      }
  };

  const handleRegenerate = (msgIndex: number) => {
      let userMsgText = "";
      for (let i = msgIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
              userMsgText = messages[i].text;
              break;
          }
      }
      if (userMsgText) {
          executeMessage(userMsgText, []);
      }
  };
  
  const handleExportMessage = (msg: ChatMessage) => {
    const markdown = `**${msg.role.toUpperCase()}** (${msg.timestamp.toLocaleString()}):\n${msg.text}\n`;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message_export_${msg.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Attachments & Audio ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const filePromises = files.map((file: File) => new Promise<Attachment>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result as string;
            const base64Data = result.split(',')[1];
            resolve({ mimeType: file.type, data: base64Data, name: file.name });
          };
          reader.readAsDataURL(file);
      }));
      const newAttachments = await Promise.all(filePromises);
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRecording = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            recordingMimeTypeRef.current = mimeType;
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: recordingMimeTypeRef.current });
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const result = reader.result as string;
                    const base64String = result.split(',')[1];
                    try {
                        setIsLoading(true);
                        const text = await transcribeAudio(base64String, recordingMimeTypeRef.current);
                        if (text) setInput(prev => (prev ? prev + " " : "") + text);
                    } catch (err) { console.error(err); alert("Failed to transcribe audio."); } 
                    finally { setIsLoading(false); }
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) { console.error(err); alert("Mic access denied."); }
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-skin-fill">
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" id="chat-container">
         {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                 {/* VISUAL HOOK: ROTATING HERO CARD */}
                 <div className="w-full max-w-sm md:max-w-md mb-8 relative group cursor-default">
                     <div className="relative bg-skin-fill-element/60 backdrop-blur-md border border-skin-border/50 p-6 rounded-2xl shadow-xl transition-all duration-700 transform">
                         <div className="text-4xl mb-3">{HERO_STORIES[storyIndex].icon}</div>
                         <h2 className="text-xl font-serif font-bold text-skin-accent mb-2 uppercase tracking-wider">
                             {HERO_STORIES[storyIndex].title}
                         </h2>
                         <p className="text-sm text-skin-muted font-sans leading-relaxed">
                             {HERO_STORIES[storyIndex].text}
                         </p>
                     </div>
                     {/* Dots Indicator */}
                     <div className="flex justify-center gap-2 mt-4">
                         {HERO_STORIES.map((_, i) => (
                             <button 
                                key={i} 
                                onClick={() => setStoryIndex(i)}
                                className={`w-2 h-2 rounded-full transition-all ${i === storyIndex ? 'bg-skin-accent w-4' : 'bg-skin-border'}`} 
                             />
                         ))}
                     </div>
                 </div>
                 
                 {/* SMART STARTERS GRID */}
                 <div className="grid grid-cols-1 gap-3 max-w-md w-full">
                     {suggestions.map((s, i) => (
                         <button 
                            key={i}
                            onClick={() => executeMessage(s, [])}
                            className="p-3 text-center bg-skin-fill-element border border-skin-border rounded-lg hover:border-skin-accent hover:bg-skin-fill-element/50 transition-all group shadow-sm hover:shadow-md animate-fade-in"
                            style={{ animationDelay: `${i * 100}ms` }}
                            title="Start this conversation"
                         >
                             <p className="text-sm font-medium text-skin-base group-hover:text-skin-accent transition-colors">
                                 {s.replace(/["*]/g, '')}
                             </p>
                         </button>
                     ))}
                 </div>
            </div>
         ) : (
            <div className="space-y-6 pb-4">
                {messages.map((msg, idx) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                        <div className={`max-w-[95%] md:max-w-[85%] rounded-xl p-4 shadow-sm relative ${
                            msg.role === 'user' 
                            ? 'bg-skin-fill-element border border-skin-border text-skin-base rounded-tr-none' 
                            : 'bg-transparent pl-4 border-l-2 border-skin-border/30 w-full rounded-none'
                        }`}>
                            
                            {msg.role === 'model' && (
                                <div className="flex items-center gap-2 mb-3 text-xs text-skin-accent font-mono uppercase tracking-widest opacity-80 select-none">
                                    <div className="w-2 h-2 rounded-full bg-skin-accent animate-pulse"></div>
                                    <span>SUNDARI AI</span>
                                </div>
                            )}

                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3 justify-end">
                                    {msg.attachments.map((att, i) => (
                                        <div key={i} className="relative group overflow-hidden rounded-lg border border-skin-border bg-skin-fill-panel shadow-sm max-w-[120px]">
                                            {att.mimeType.startsWith('image/') ? (
                                                <img src={`data:${att.mimeType};base64,${att.data}`} alt="attachment" className="h-16 w-full object-cover" />
                                            ) : (
                                                <div className="h-16 w-full flex items-center justify-center p-2">
                                                    <span className="text-[10px] text-skin-muted text-center break-all line-clamp-2">{att.name || 'File'}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={`prose prose-sm max-w-none 
                                ${msg.role === 'user' ? 'text-right' : 'text-left dark:prose-invert text-skin-base'}
                                [&>h1]:text-2xl [&>h1]:font-serif [&>h1]:text-skin-accent [&>h1]:mt-6 [&>h1]:mb-4
                                [&>h2]:text-xl [&>h2]:font-serif [&>h2]:text-skin-accent/90 [&>h2]:mt-5 [&>h2]:mb-3
                                [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-skin-base [&>h3]:mt-4
                                [&>p]:leading-relaxed [&>p]:mb-4
                                [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4
                                [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-4
                                [&>li]:mb-1
                                [&>blockquote]:border-l-4 [&>blockquote]:border-skin-accent [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:bg-skin-fill-element/30 [&>blockquote]:py-1 [&>blockquote]:my-4
                                [&>table]:w-full [&>table]:border-collapse [&>table]:my-4
                                [&>th]:border-b [&>th]:border-skin-border [&>th]:text-left [&>th]:p-2 [&>th]:text-skin-accent
                                [&>td]:border-b [&>td]:border-skin-border [&>td]:p-2
                                [&>pre]:bg-skin-fill-panel [&>pre]:border [&>pre]:border-skin-border [&>pre]:rounded-lg [&>pre]:p-4 [&>pre]:overflow-x-auto [&>pre]:my-4
                                [&>code]:font-mono [&>code]:text-xs
                            `}>
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                                ) : (
                                    <ReactMarkdown>
                                        {msg.translation?.active ? msg.translation.text : msg.text}
                                    </ReactMarkdown>
                                )}
                            </div>
                            
                            {msg.role === 'model' && !msg.isStreaming && (
                                <div className="mt-4 pt-3 flex items-center gap-4 text-skin-muted opacity-60 hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleCopy(msg.translation?.active ? (msg.translation.text || "") : msg.text)} className="hover:text-skin-accent flex items-center gap-1.5 transition-colors group text-xs font-mono uppercase tracking-wide" title="Copy"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                                    <button onClick={() => handleTranslate(msg.id, msg.text, msg.translation)} className={`flex items-center gap-1.5 transition-colors text-xs font-mono uppercase tracking-wide ${msg.translation?.active ? 'text-skin-accent' : 'hover:text-skin-accent'}`} title="Translate"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></button>
                                    <button onClick={async () => { try { const audioBuffer = await generateSpeech(msg.translation?.active ? msg.translation.text : msg.text.substring(0,300)); const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000}); const decoded = await decodeAudioData(audioBuffer, ctx); const source = ctx.createBufferSource(); source.buffer = decoded; source.connect(ctx.destination); source.start(); } catch(e) { console.error(e); } }} className="hover:text-skin-accent flex items-center gap-1.5 transition-colors text-xs font-mono uppercase tracking-wide group" title="Listen"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
                                    <button onClick={() => handleRegenerate(idx)} className="hover:text-skin-accent flex items-center gap-1.5 transition-colors text-xs font-mono uppercase tracking-wide group" title="Regenerate"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg></button>
                                    <button onClick={() => handleShare(msg.translation?.active ? msg.translation.text : msg.text)} className="hover:text-skin-accent flex items-center gap-1.5 transition-colors text-xs font-mono uppercase tracking-wide group" title="Share"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></button>
                                    <button onClick={() => handleExportMessage(msg)} className="hover:text-skin-accent flex items-center gap-1.5 transition-colors text-xs font-mono uppercase tracking-wide group" title="Export Message"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
         )}
      </div>

      <div className="p-4 bg-skin-fill-panel/30 backdrop-blur-sm relative z-10 space-y-4">
         {/* AI TOOLS BAR - REDESIGNED */}
         <div className="flex items-center justify-center">
             <div className="flex items-center border border-skin-border rounded-lg p-1 bg-skin-fill-element shadow-lg text-skin-base">
                 
                 {/* THINKING TOGGLE */}
                 <button 
                    onClick={() => setUseThinking(!useThinking)} 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all group"
                    title="Enable Deep Thinking"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors ${useThinking ? 'text-skin-accent' : 'text-skin-muted group-hover:text-skin-base'}`}>
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.7 10.2 18 9 18 7.5a6 6 0 0 0-12 0c0 1.5.3 2.7 1.5 3.9.8.8 1.3 1.5 1.5 2.5"/>
                        <path d="M9 18h6"/>
                        <path d="M10 22h4"/>
                    </svg>
                     <span className={`text-xs font-bold uppercase tracking-widest ${useThinking ? 'text-skin-accent' : 'text-skin-muted group-hover:text-skin-base'}`}>Deep Think</span>
                 </button>

                 <div className="w-px h-5 bg-skin-border mx-1"></div>

                 {/* GROUNDING TOGGLE */}
                 <div className="relative group/grounding">
                    <button 
                        onClick={() => setUseSearch(!useSearch)} 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all group"
                        title="Enable Web Search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors ${useSearch ? 'text-skin-accent' : 'text-skin-muted group-hover:text-skin-base'}`}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <span className={`text-xs font-bold uppercase tracking-widest ${useSearch ? 'text-skin-accent' : 'text-skin-muted group-hover:text-skin-base'}`}>Web Search</span>
                    </button>
                    {useSearch && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-skin-fill-panel border border-skin-border p-2 rounded-lg shadow-xl z-20 animate-fade-in after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-skin-border">
                            <input 
                                type="text" 
                                value={searchFocus} 
                                onChange={(e) => setSearchFocus(e.target.value)} 
                                placeholder="e.g. site:wikipedia.org" 
                                className="w-full bg-skin-fill-element text-xs p-2 rounded border border-transparent focus:border-skin-accent outline-none text-center placeholder:text-skin-muted/50" 
                            />
                        </div>
                    )}
                 </div>

                 <div className="w-px h-5 bg-skin-border mx-1"></div>

                 {/* NEW CHAT BUTTON */}
                 <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNewChat?.(); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all group"
                    title="Start New Chat"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-skin-muted group-hover:text-skin-accent group-hover:rotate-90 transition-transform"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                     <span className="text-xs font-bold uppercase tracking-widest text-skin-muted group-hover:text-skin-accent">New Chat</span>
                 </button>
             </div>
         </div>

         <div className="relative flex items-end gap-2 bg-skin-fill-element border border-skin-border rounded-lg p-2 focus-within:border-skin-accent transition-colors shadow-sm">
             <button onClick={() => fileInputRef.current?.click()} className="p-2 text-skin-muted hover:text-skin-accent transition-colors" title="Attach Image/File"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,application/pdf,text/*" />
             <div className="flex-1 min-w-0">
                 {attachments.length > 0 && (
                     <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                         {attachments.map((att, idx) => (
                             <div key={idx} className="relative bg-skin-fill-panel border border-skin-border rounded px-2 py-1 flex items-center gap-2"><span className="text-xs text-skin-base truncate max-w-[100px]">{att.name || 'File'}</span><button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-skin-muted hover:text-red-500" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>
                         ))}
                     </div>
                 )}
                 <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isRecording ? "Listening..." : "Message SUNDARI..."} rows={1} className="w-full bg-transparent border-none outline-none text-skin-base resize-none py-2 max-h-32 placeholder:text-skin-muted" style={{ minHeight: '40px' }} />
             </div>
             {input.trim() || attachments.length > 0 ? (
                 <button onClick={handleSend} disabled={isLoading} className="p-2 bg-skin-accent text-skin-fill-panel rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 animate-border-glow shadow-sm" title="Send"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
             ) : (
                 <button onClick={toggleRecording} className={`p-2 rounded-md transition-all animate-border-glow shadow-sm ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-skin-muted hover:text-skin-accent'}`} title={isRecording ? "Stop" : "Speak"}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"></line></svg></button>
             )}
         </div>
      </div>
    </div>
  );
};

export default ChatConsole;
