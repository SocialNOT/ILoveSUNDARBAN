/*
 * SAMSAYA AI BOILERPLATE
 * An Initiative of I💚Sundarban
 * Coded by Rajib Singh
 * Contact: admin@ilovesundarban.com | +91 7998300083
 */

import React, { useState, useEffect, useRef } from 'react';
import SyllabusView from './components/SyllabusView';
import HistoryView from './components/HistoryView';
import ChatConsole from './components/ChatConsole';
import Logo from './components/Logo';
import { ChatMessage, Theme, ThemeMode, SyllabusData, SourcePrimary, UserProfile, SavedState } from './types';
import { SYLLABUS as DEFAULT_SYLLABUS, PERSONA_INSTRUCTION as DEFAULT_PERSONA } from './constants';
import { analyzeKnowledgeBase, generatePersonaVariations, PersonaVariation, generatePersonaDraft, generateSyllabusFromPersona, generateAppConfiguration, isGeminiConfigured, getUserApiKey, setUserApiKey as saveUserApiKey } from './services/geminiService';
import { initializeFirebase, loadSession, saveSession, saveUserProfile, signInWithGoogle, signOutUser } from './services/firebaseService';
import { initializeSupabase, loadSessionFromSupabase, saveSessionToSupabase, saveUserProfileToSupabase } from './services/supabaseService';

type ConfigTab = 'general' | 'knowledge' | 'connections';

interface GuestData {
    date: string;     // YYYY-MM-DD
    startTime: number; // Timestamp
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mobileTab, setMobileTab] = useState<'syllabus' | 'console' | 'history'>('console');
  const [requestedQuery, setRequestedQuery] = useState<string>('');
  
  // App Config State
  const [syllabusData, setSyllabusData] = useState<SyllabusData>(DEFAULT_SYLLABUS);
  const [persona, setPersona] = useState<string>(DEFAULT_PERSONA);
  const [appName, setAppName] = useState<string>('I♥Sundarban');
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [regForm, setRegForm] = useState({ name: '', email: '', mobile: '' });
  
  // Guest Mode State
  const [guestSession, setGuestSession] = useState<GuestData | null>(null);
  const [guestTimeRemaining, setGuestTimeRemaining] = useState<number>(0); // in minutes
  
  // Theme State - Lazy Initialization to prioritize Saved Preference
  const [theme, setTheme] = useState<Theme>(() => {
      // Try to find saved state
      const sid = localStorage.getItem('ai_console_session_id');
      if (sid) {
          const saved = localStorage.getItem(`ai_console_state_${sid}`);
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  if (parsed.theme) return parsed.theme;
              } catch(e) {}
          }
      }
      return 'friday'; // Default to new Sundarban theme
  });

  const [mode, setMode] = useState<ThemeMode>(() => {
      const currentHour = new Date().getHours();
      const autoMode = (currentHour >= 6 && currentHour < 18) ? 'light' : 'dark';

      const sid = localStorage.getItem('ai_console_session_id');
      if (sid) {
          const saved = localStorage.getItem(`ai_console_state_${sid}`);
          if (saved) {
              try {
                  const parsed = JSON.parse(saved);
                  if (parsed.mode) return parsed.mode;
              } catch(e) {}
          }
      }
      return 'dark'; // Default to dark mode for new theme
  });

  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('general');

  // Config Inputs - Initialize EMPTY to show placeholders by default
  const [configName, setConfigName] = useState('');
  const [configPersona, setConfigPersona] = useState('');
  
  const [personaDescription, setPersonaDescription] = useState('');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isGeminiReady, setIsGeminiReady] = useState(false);
  const [userApiKey, setUserApiKeyInput] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [isPopulatingKB, setIsPopulatingKB] = useState(false);
  const [personaOptions, setPersonaOptions] = useState<PersonaVariation[]>([]);
  
  // Paste Input State
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteInput, setPasteInput] = useState('');

  // Manual Chat Starters
  const [chatStartersInput, setChatStartersInput] = useState('');
  
  // InfoTicker State
  const [dateTime, setDateTime] = useState(new Date());
  const [weather, setWeather] = useState<{temp: number, code: number} | null>(null);

  // Console Reset Key
  const [consoleKey, setConsoleKey] = useState(0);

  // FIX: Lifted state for model selection
  const [useThinking, setUseThinking] = useState(false);

  const fileUploadRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>('');

  const GUEST_LIMIT_MINUTES = 60;

  // 0. Check User Registration, Guest Status & Weather Logic
  useEffect(() => {
    // Check Local Storage for User Profile
    const storedUser = localStorage.getItem('ai_console_user_profile');
    if (storedUser) {
      try {
        setUserProfile(JSON.parse(storedUser));
      } catch (e) {
        console.error("Invalid user profile");
      }
    } else {
        // Check Guest Status if no user profile
        checkGuestAvailability();
    }
    
    // Set up API key state
    setUserApiKeyInput(getUserApiKey());
    setIsGeminiReady(isGeminiConfigured());

    // Function to update Date/Time
    const timer = setInterval(() => setDateTime(new Date()), 1000);

    // Guest Timer Check (every minute)
    const guestTimer = setInterval(() => {
        if (!userProfile) {
             const storedGuest = localStorage.getItem('ai_console_guest_data');
             if (storedGuest) {
                 const guest: GuestData = JSON.parse(storedGuest);
                 const now = Date.now();
                 const elapsed = (now - guest.startTime) / 1000 / 60; // minutes
                 const remaining = Math.max(0, GUEST_LIMIT_MINUTES - elapsed);
                 setGuestTimeRemaining(Math.floor(remaining));
                 
                 if (remaining <= 0 && guestSession) {
                     // Expire
                     setGuestSession(null);
                     localStorage.removeItem('ai_console_guest_data');
                     alert("Guest session expired. Please register for full access.");
                 }
             }
        }
    }, 60000);

    // Initialize Clouds (Async)
    const initClouds = async () => {
        const fbSuccess = await initializeFirebase();
        setIsFirebaseConnected(fbSuccess);
        
        const sbSuccess = initializeSupabase();
        setIsSupabaseConnected(sbSuccess);
    };
    initClouds();
    
    // Weather Fetch (Mock/Free API)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=22.57&longitude=88.36&current_weather=true')
        .then(res => res.json())
        .then(data => {
            if (data.current_weather) {
                setWeather({ temp: data.current_weather.temperature, code: data.current_weather.weathercode });
            }
        })
        .catch(err => {}); // Silent catch

    return () => { clearInterval(timer); clearInterval(guestTimer); };
  }, [userProfile, guestSession]);

  const checkGuestAvailability = () => {
      const storedGuest = localStorage.getItem('ai_console_guest_data');
      if (storedGuest) {
          const guest: GuestData = JSON.parse(storedGuest);
          const today = new Date().toISOString().split('T')[0];
          
          if (guest.date === today) {
              const now = Date.now();
              const elapsed = (now - guest.startTime) / 1000 / 60;
              if (elapsed < GUEST_LIMIT_MINUTES) {
                   setGuestSession(guest);
                   setGuestTimeRemaining(Math.floor(GUEST_LIMIT_MINUTES - elapsed));
              }
          } else {
              // Reset for new day
              localStorage.removeItem('ai_console_guest_data');
          }
      }
  };

  const handleGuestLogin = () => {
      const today = new Date().toISOString().split('T')[0];
      const newGuest: GuestData = { date: today, startTime: Date.now() };
      localStorage.setItem('ai_console_guest_data', JSON.stringify(newGuest));
      setGuestSession(newGuest);
      setGuestTimeRemaining(GUEST_LIMIT_MINUTES);
  };

  const handleRegister = () => {
      if (regForm.name && regForm.email && regForm.mobile) {
          const newUser: UserProfile = { ...regForm, registeredAt: Date.now() };
          localStorage.setItem('ai_console_user_profile', JSON.stringify(newUser));
          setUserProfile(newUser);
          saveUserProfile(newUser); // Save to Firebase
          saveUserProfileToSupabase(newUser); // Save to Supabase
      } else {
          alert("Please fill in all fields.");
      }
  };

  const handleGoogleLogin = async () => {
      const profile = await signInWithGoogle();
      if (profile) {
          localStorage.setItem('ai_console_user_profile', JSON.stringify(profile));
          setUserProfile(profile);
          saveUserProfile(profile); // Save to Firebase
          saveUserProfileToSupabase(profile); // Save to Supabase
      }
  };
  
  const handleLogout = async () => {
      if (confirm("Are you sure you want to log out?")) {
          await signOutUser();
          localStorage.removeItem('ai_console_user_profile');
          localStorage.removeItem('ai_console_guest_data');
          setUserProfile(null);
          setGuestSession(null);
      }
  };

  // 1. Initialize & Load Session
  useEffect(() => {
    // Generate or retrieve Session ID
    let sid = localStorage.getItem('ai_console_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem('ai_console_session_id', sid);
    }
    sessionIdRef.current = sid;

    // Load Session Data (Local)
    const saved = localStorage.getItem(`ai_console_state_${sid}`);
    if (saved) {
      try {
        const state: SavedState = JSON.parse(saved);
        setAppName(state.appName);
        setPersona(state.persona);
        setSyllabusData(state.syllabusData);
        if (state.theme) setTheme(state.theme);
        if (state.mode) setMode(state.mode);
        
        // Restore config inputs IF they are custom
        if (state.appName !== 'I♥Sundarban') setConfigName(state.appName);
        if (state.persona !== DEFAULT_PERSONA) setConfigPersona(state.persona);
        
        // Rehydrate Dates
        const hydratedMessages = state.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(hydratedMessages);
      } catch (e) {
        console.error("Failed to load local session", e);
      }
    }
  }, []);

  // 2. Load Data from Cloud if Connected
  useEffect(() => {
    if (sessionIdRef.current) {
        // Try loading from Firebase
        if (isFirebaseConnected) {
            loadSession(sessionIdRef.current).then(remoteState => {
                if (remoteState) updateStateFromRemote(remoteState);
            });
        }
        // Try loading from Supabase (Supabase overrides Firebase if newer, theoretically, but here simple load)
        if (isSupabaseConnected) {
            loadSessionFromSupabase(sessionIdRef.current).then(remoteState => {
                if (remoteState) updateStateFromRemote(remoteState);
            });
        }
    }
  }, [isFirebaseConnected, isSupabaseConnected]);

  const updateStateFromRemote = (remoteState: Partial<SavedState>) => {
       if (remoteState.appName) setAppName(remoteState.appName);
       if (remoteState.persona) setPersona(remoteState.persona);
       if (remoteState.syllabusData) setSyllabusData(remoteState.syllabusData);
       if (remoteState.theme) setTheme(remoteState.theme);
       if (remoteState.mode) setMode(remoteState.mode);
       if (remoteState.messages) {
           // Safely handle timestamp which might be string or number from DB
           const hydrated = remoteState.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
           setMessages(hydrated);
       }
  };

  // 3. Auto-Save Logic (Debounced)
  useEffect(() => {
    if (!sessionIdRef.current) return;

    const saveData = () => {
      const stateToSave = {
        appName,
        persona,
        syllabusData,
        messages,
        theme,
        mode,
        lastUpdated: Date.now()
      };
      
      // Local Save
      localStorage.setItem(`ai_console_state_${sessionIdRef.current}`, JSON.stringify(stateToSave));
      
      // Cloud Save (Dual Write)
      if (isFirebaseConnected) {
        saveSession(sessionIdRef.current, stateToSave);
      }
      if (isSupabaseConnected) {
        saveSessionToSupabase(sessionIdRef.current, stateToSave);
      }
    };

    const handler = setTimeout(saveData, 2000);
    return () => clearTimeout(handler);
  }, [messages, appName, persona, syllabusData, theme, mode, isFirebaseConnected, isSupabaseConnected]);

  const handleQueryRequest = (query: string) => {
    setRequestedQuery(query);
    setMobileTab('console'); // Switch to console on mobile
  };

  const handleKBFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      setIsAnalyzing(true);
      reader.onload = async (ev) => {
        const text = ev.target?.result as string;
        await processNewSource(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const processNewSource = async (text: string, title: string) => {
      setIsAnalyzing(true);
      const analysis = await analyzeKnowledgeBase(text);
      
      setSyllabusData(prev => {
        // Create new primary source entry
        const newSource: SourcePrimary = {
           text: analysis.project_title === "Uploaded Knowledge Base" ? title : analysis.project_title || title,
           concept_focus: analysis.core_concept,
           content: text // Store full content for RAG
        };

        // Merge Metadata
        return {
           ...prev,
           project_title: prev.project_title === 'I💚Sundarban Tutorial' ? (analysis.project_title || title) : prev.project_title,
           core_concept: prev.core_concept === 'Boilerplate Configuration Guide' ? (analysis.core_concept || "Custom Knowledge") : prev.core_concept,
           primary_sources_en: [newSource, ...prev.primary_sources_en],
           secondary_sources: [...(analysis.secondary_sources || []), ...prev.secondary_sources],
           key_terms: Array.from(new Set([...(analysis.key_terms || []), ...prev.key_terms]))
        };
      });
      setIsAnalyzing(false);
      setPasteInput('');
      setShowPasteInput(false);
  };

  const handlePasteAnalyze = async () => {
      if (!pasteInput.trim()) return;
      await processNewSource(pasteInput, "Pasted Content");
  };

  const handleGeneratePersona = async () => {
      if (!personaDescription.trim()) return;
      setIsGeneratingPersona(true);
      try {
          const variations = await generatePersonaVariations(personaDescription);
          setPersonaOptions(variations);
      } catch (e) {
          alert("Failed to generate persona. Please check your API Key in the Agent Console.");
      } finally {
          setIsGeneratingPersona(false);
      }
  };
  
  const handleAutoPopulateKB = async () => {
      if (!configPersona) return;
      setIsPopulatingKB(true);
      try {
          const newData = await generateSyllabusFromPersona(configPersona);
          setSyllabusData(prev => ({
              ...prev,
              ...newData,
              // Keep existing full content sources if needed, or replace? 
              // Usually we want to keep uploaded files but update metadata.
              // For "Auto-Populate", we'll assume a refresh of context.
              primary_sources_en: [...prev.primary_sources_en, ...newData.primary_sources_en]
          }));
      } catch(e) {
          console.error(e);
          alert("Failed to auto-populate knowledge base.");
      } finally {
          setIsPopulatingKB(false);
      }
  };

  const handleAutoConfigure = async () => {
      if (!personaDescription.trim()) return;
      setIsGeneratingPersona(true);
      try {
          const config = await generateAppConfiguration(personaDescription);
          setConfigName(config.appName);
          setConfigPersona(config.persona);
          setSyllabusData(prev => ({
              ...prev,
              ...config.syllabus
          }));
          // Also set active app state
          setAppName(config.appName);
          setPersona(config.persona);
      } catch (e) {
          console.error(e);
          alert("Failed to auto-configure.");
      } finally {
          setIsGeneratingPersona(false);
      }
  };
  
  const handleSaveApiKey = () => {
      const keyRegex = /^[A-Za-z0-9_-]{30,}$/;
      if (userApiKey && keyRegex.test(userApiKey)) {
          saveUserApiKey(userApiKey);
          setIsGeminiReady(isGeminiConfigured());
          alert('API Key updated successfully.');
      } else if (!userApiKey) {
          saveUserApiKey('');
          setIsGeminiReady(isGeminiConfigured());
          alert('Custom API Key cleared. Using default key if available.');
      } else {
          alert('Invalid API Key format. Please check your key and try again.');
      }
  };

  const saveConfiguration = () => {
      // Fallback to defaults if saved empty
      const finalAppName = configName.trim() === '' ? 'I♥Sundarban' : configName;
      const finalPersona = configPersona.trim() === '' ? DEFAULT_PERSONA : configPersona;
      
      setAppName(finalAppName);
      setPersona(finalPersona);

      if (chatStartersInput) {
          const newStarters = chatStartersInput.split(',').map(s => s.trim()).filter(s => s);
          setSyllabusData(prev => ({ ...prev, suggested_queries: newStarters }));
      }
      
      setShowConfigModal(false);
  };
  
  const resetConfiguration = () => {
      if (confirm("Reset everything to default I♥Sundarban settings?")) {
          setAppName('I♥Sundarban');
          setPersona(DEFAULT_PERSONA);
          setSyllabusData(DEFAULT_SYLLABUS);
          setConfigName('');
          setConfigPersona('');
          setChatStartersInput('');
          setShowConfigModal(false);
      }
  };

  const clearChatHistory = () => {
      if (window.confirm("Clear all chat messages? This cannot be undone.")) {
          setMessages([]);
          // Force immediate save to clear local storage
          if (sessionIdRef.current) {
              const emptyState = {
                  appName,
                  persona,
                  syllabusData,
                  messages: [],
                  theme,
                  mode,
                  lastUpdated: Date.now()
              };
              localStorage.setItem(`ai_console_state_${sessionIdRef.current}`, JSON.stringify(emptyState));
              if (isFirebaseConnected) {
                  saveSession(sessionIdRef.current, emptyState);
              }
              if (isSupabaseConnected) {
                  saveSessionToSupabase(sessionIdRef.current, emptyState);
              }
          }
      }
  };

  // Instant New Chat - No Confirm, Just Action
  const startNewChat = () => {
      setMessages([]);
      setConsoleKey(prev => prev + 1); // Increment key to force ChatConsole remount/refresh
      
      if (sessionIdRef.current) {
          const emptyState = {
              appName,
              persona,
              syllabusData,
              messages: [],
              theme,
              mode,
              lastUpdated: Date.now()
          };
          localStorage.setItem(`ai_console_state_${sessionIdRef.current}`, JSON.stringify(emptyState));
          if (isFirebaseConnected) {
              saveSession(sessionIdRef.current, emptyState);
          }
          if (isSupabaseConnected) {
              saveSessionToSupabase(sessionIdRef.current, emptyState);
          }
      }
  };

  const handleExportConfig = () => {
      const exportData = {
          appName,
          persona,
          syllabusData,
          messages,
          theme,
          mode
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai-console-config.json';
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const data = JSON.parse(ev.target?.result as string);
              if (data.appName) {
                  setAppName(data.appName);
                  setConfigName(data.appName);
              }
              if (data.persona) {
                  setPersona(data.persona);
                  setConfigPersona(data.persona);
              }
              if (data.syllabusData) setSyllabusData(data.syllabusData);
              if (data.messages) {
                   setMessages(data.messages.map((m: any) => ({...m, timestamp: new Date(m.timestamp)})));
              }
              alert("Configuration loaded successfully!");
          } catch (err) {
              alert("Invalid config file.");
          }
      };
      reader.readAsText(file);
  };

  const removeSource = (idx: number) => {
      setSyllabusData(prev => ({
          ...prev,
          primary_sources_en: prev.primary_sources_en.filter((_, i) => i !== idx)
      }));
  };

  // --- ACCESS GATEWAY ---
  if (!userProfile && !guestSession) {
      return (
        <div className="h-[100dvh] w-full flex items-center justify-center bg-gradient-to-br from-skin-fill via-skin-fill-panel to-skin-fill p-4 font-mono relative overflow-hidden" data-theme={theme} data-mode={mode}>
           {/* Animated Background */}
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
           <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-r from-skin-accent/10 to-transparent animate-spin-slow pointer-events-none" style={{ animationDuration: '20s' }}></div>

           <div className="w-full max-w-md bg-skin-fill-panel/80 backdrop-blur-xl border border-skin-border/50 p-8 rounded-2xl shadow-2xl relative z-10">
               
               <div className="text-center mb-8">
                   <Logo variant="footer" />
                   <p className="text-skin-muted text-xs uppercase tracking-widest mt-4">Secure Research Gateway</p>
               </div>

               <div className="space-y-4">
                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-skin-muted group-focus-within:text-skin-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Full Name"
                        value={regForm.name}
                        onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                        className="w-full bg-skin-fill-element border border-skin-border text-skin-base p-3 pl-10 rounded-lg focus:border-skin-accent outline-none text-center transition-colors shadow-inner tooltip"
                        title="Enter your full name for the session record"
                      />
                  </div>
                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-skin-muted group-focus-within:text-skin-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <input 
                        type="email" 
                        placeholder="Email Address"
                        value={regForm.email}
                        onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                        className="w-full bg-skin-fill-element border border-skin-border text-skin-base p-3 pl-10 rounded-lg focus:border-skin-accent outline-none text-center transition-colors shadow-inner tooltip"
                        title="Enter a valid email address"
                      />
                  </div>
                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-skin-muted group-focus-within:text-skin-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Mobile Number"
                        value={regForm.mobile}
                        onChange={(e) => setRegForm({...regForm, mobile: e.target.value})}
                        className="w-full bg-skin-fill-element border border-skin-border text-skin-base p-3 pl-10 rounded-lg focus:border-skin-accent outline-none text-center transition-colors shadow-inner tooltip"
                        title="Enter your mobile number"
                      />
                  </div>

                  <button 
                    onClick={handleRegister}
                    className="w-full bg-gradient-to-r from-skin-accent to-skin-accent/80 text-skin-fill font-bold uppercase tracking-widest py-3 rounded-lg hover:shadow-lg hover:shadow-skin-accent/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-4 tooltip animate-border-glow"
                    title="Start your secure session"
                  >
                      Initialize System
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </button>

                  <div className="flex items-center gap-4 my-4">
                      <div className="h-px bg-skin-border flex-1"></div>
                      <span className="text-[10px] text-skin-muted uppercase tracking-widest">OR</span>
                      <div className="h-px bg-skin-border flex-1"></div>
                  </div>

                  <button 
                      onClick={handleGoogleLogin}
                      className="w-full bg-white text-gray-800 font-bold uppercase tracking-widest py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-transparent hover:border-gray-300"
                      title="Sign in with Google"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                      Sign in with Google
                  </button>
               </div>

               <div className="mt-8 flex flex-col items-center gap-3">
                   <div className="h-px w-full bg-skin-border/50"></div>
                   <div className="flex items-center gap-2 text-xs text-skin-muted">
                        <span>Just exploring?</span>
                        <button 
                            onClick={handleGuestLogin}
                            className="px-3 py-1 bg-skin-fill-element border border-skin-border rounded-full hover:bg-skin-accent hover:text-skin-fill transition-colors tooltip hover:animate-pulse"
                            title="Temporary 60m session"
                        >
                            Continue as Guest (60m daily)
                        </button>
                   </div>
               </div>
           </div>
        </div>
      );
  }

  // --- MAIN APP ---
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-skin-fill text-skin-base font-sans transition-colors duration-500 overflow-hidden" data-theme={theme} data-mode={mode}>
      {/* Header */}
      <header className="h-auto min-h-[3.5rem] py-2 px-4 md:px-6 border-b border-skin-border flex items-center justify-between bg-skin-fill-panel relative z-20">
        <Logo variant="header" text={appName} />

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button 
             onClick={() => setShowConfigModal(true)}
             className="p-2 text-skin-muted hover:text-skin-accent transition-colors tooltip"
             title="Agent Console"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
          
          <div className="relative">
             <button 
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2 text-skin-muted hover:text-skin-accent transition-colors tooltip"
                title="Change Theme"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C5 11.1 4 13 4 15a7 7 0 0 0 7 7z"></path></svg>
             </button>
             {showThemeMenu && (
                 <div className="absolute top-full right-0 mt-2 w-48 bg-skin-fill-panel border border-skin-border rounded-lg shadow-xl py-2 z-50">
                     {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as Theme[]).map(t => (
                         <button 
                            key={t}
                            onClick={() => { setTheme(t); setShowThemeMenu(false); }}
                            className={`w-full text-left px-4 py-2 text-xs uppercase tracking-wide hover:bg-skin-fill-element ${theme === t ? 'text-skin-accent font-bold' : 'text-skin-muted'}`}
                         >
                             {t}
                         </button>
                     ))}
                 </div>
             )}
          </div>

          <button 
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            className="p-2 text-skin-muted hover:text-skin-accent transition-colors tooltip"
            title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
             {mode === 'dark' ? (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
             ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
             )}
          </button>
          
          <button 
                onClick={handleLogout}
                className="p-2 text-skin-muted hover:text-red-400 transition-colors tooltip"
                title="Log Out"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </header>

      {/* NEW FULL WIDTH TICKER BAR */}
      <div className="w-full h-8 bg-skin-fill-panel border-b border-skin-border flex items-center px-4 gap-4 overflow-hidden relative z-10">
          {/* Static Time */}
          <div className="text-[10px] font-mono text-skin-accent shrink-0 bg-skin-fill-panel pr-2 z-10 h-full flex items-center">
              {dateTime.toLocaleTimeString([], {hour12: false})}
          </div>
          
          <div className="w-[1px] h-3 bg-skin-border shrink-0 z-10"></div>
          
          {/* Marquee Content */}
          <div className="flex-1 overflow-hidden relative h-full">
              <div className="absolute top-0 left-0 whitespace-nowrap animate-marquee flex items-center gap-8 h-full text-[10px] text-skin-muted font-mono tracking-wide">
                  <span>{dateTime.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'})}</span>
                  {weather && <span>{weather.temp}°C {weather.code < 3 ? 'CLEAR' : 'CLOUDY'}</span>}
                  {guestSession && <span className="text-red-400 uppercase">Mode: {guestTimeRemaining}m Remaining</span>}
                  <span>{mode.toUpperCase()} MODE ACTIVE</span>
                  <span>THEME: {theme.toUpperCase()}</span>
              </div>
          </div>
      </div>

      {/* Main Content Area - Responsive Flex */}
      <main className="flex-1 flex min-h-0 relative">
         {/* Desktop Sidebar (Left) - Syllabus */}
         <section className={`absolute top-0 left-0 right-0 bottom-16 md:bottom-0 md:relative md:w-80 md:border-r border-skin-border bg-skin-fill-panel z-10 transition-transform duration-300 ${mobileTab === 'syllabus' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
             <SyllabusView data={syllabusData} onQuerySelect={handleQueryRequest} />
         </section>

         {/* Center Console */}
         <section className="flex-1 flex flex-col min-w-0 bg-skin-fill relative z-0 mb-16 md:mb-0">
             <ChatConsole 
                key={consoleKey}
                messages={messages} 
                setMessages={setMessages} 
                requestedQuery={requestedQuery} 
                onQueryHandled={() => setRequestedQuery('')}
                persona={persona}
                knowledgeBase={syllabusData}
                onNewChat={startNewChat}
                useThinking={useThinking}
                setUseThinking={setUseThinking}
             />
         </section>

         {/* Desktop Sidebar (Right) - History */}
         <section className={`absolute top-0 left-0 right-0 bottom-16 md:bottom-0 md:relative md:w-72 md:border-l border-skin-border bg-skin-fill-panel z-10 transition-transform duration-300 ${mobileTab === 'history' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
             <HistoryView messages={messages} onHistorySelect={handleQueryRequest} useThinking={useThinking} />
         </section>
      </main>

      {/* Mobile Tab Navigation - Redesigned Grid with Radio Selection */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-skin-fill-panel/95 backdrop-blur-md border-t border-skin-border z-50 grid grid-cols-3">
          {/* Data Tab */}
          <button 
            onClick={() => setMobileTab('syllabus')}
            className="flex flex-col items-center justify-center relative group border-r border-skin-border/30"
            title="Data Sources"
          >
              <div className={`p-2 rounded-full transition-all duration-300 ${mobileTab === 'syllabus' ? 'bg-skin-accent text-skin-fill-panel scale-110 shadow-lg' : 'text-skin-muted hover:bg-skin-fill-element'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors ${mobileTab === 'syllabus' ? 'text-skin-accent' : 'text-skin-muted'}`}>Data</span>
          </button>

          {/* Console Tab */}
          <button 
            onClick={() => setMobileTab('console')}
            className="flex flex-col items-center justify-center relative group border-r border-skin-border/30"
            title="AI Console"
          >
              <div className={`p-2 rounded-full transition-all duration-300 ${mobileTab === 'console' ? 'bg-skin-accent text-skin-fill-panel scale-110 shadow-lg' : 'text-skin-muted hover:bg-skin-fill-element'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="12" rx="2" ry="2"></rect><line x1="8" y1="20" x2="16" y2="20"></line><line x1="12" y1="16" x2="12" y2="20"></line></svg>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors ${mobileTab === 'console' ? 'text-skin-accent' : 'text-skin-muted'}`}>Console</span>
          </button>

          {/* Audit Tab */}
          <button 
            onClick={() => setMobileTab('history')}
            className="flex flex-col items-center justify-center relative group"
            title="Audit Logs"
          >
              <div className={`p-2 rounded-full transition-all duration-300 ${mobileTab === 'history' ? 'bg-skin-accent text-skin-fill-panel scale-110 shadow-lg' : 'text-skin-muted hover:bg-skin-fill-element'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors ${mobileTab === 'history' ? 'text-skin-accent' : 'text-skin-muted'}`}>Audit</span>
          </button>
      </nav>

      {/* Settings Modal */}
      {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-skin-fill-panel border border-skin-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-skin-border flex items-center justify-between bg-skin-fill-element/50">
                      <h2 className="text-lg font-serif font-bold text-skin-accent">Agent Console</h2>
                      <button onClick={() => setShowConfigModal(false)} className="text-skin-muted hover:text-skin-accent" title="Close Settings">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex border-b border-skin-border p-1 bg-skin-fill-element/30">
                      {(['general', 'knowledge', 'connections'] as ConfigTab[]).map(tab => (
                          <button
                            key={tab}
                            onClick={() => setConfigTab(tab)}
                            className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold transition-all rounded ${configTab === tab ? 'bg-skin-fill text-skin-accent shadow-sm animate-border-glow' : 'text-skin-muted hover:text-skin-base'}`}
                            title={`Open ${tab} settings`}
                          >
                              {tab}
                          </button>
                      ))}
                  </div>

                  <div className="p-6 overflow-y-auto flex-1">
                      {configTab === 'general' && (
                          <div className="space-y-6">
                              <div>
                                  <input 
                                    type="text" 
                                    value={configName}
                                    onChange={(e) => setConfigName(e.target.value)}
                                    className="w-full bg-skin-fill-element border border-skin-border text-skin-base p-3 rounded focus:border-skin-accent outline-none font-mono text-sm placeholder:text-skin-muted/50"
                                    placeholder="Name your Agent (e.g. Legal Research Companion)"
                                  />
                              </div>
                              
                              <div>
                                  <textarea 
                                    value={configPersona}
                                    onChange={(e) => setConfigPersona(e.target.value)}
                                    className="w-full h-40 bg-skin-fill-element border border-skin-border text-skin-base p-3 rounded focus:border-skin-accent outline-none font-mono text-sm resize-none placeholder:text-skin-muted/50"
                                    placeholder="Describe the Agent's Persona (e.g. 'You are an expert historian...')"
                                  />
                              </div>
                              
                              {/* Auto Config Section */}
                              <div className="pt-4 border-t border-skin-border/50">
                                 <label className="text-xs font-mono uppercase tracking-widest text-skin-muted mb-2 block">AI Auto-Configuration</label>
                                 <div className="flex gap-2">
                                     <input 
                                        type="text" 
                                        value={personaDescription} 
                                        onChange={(e) => setPersonaDescription(e.target.value)}
                                        placeholder="Describe the role (e.g. 'A strict biology teacher')"
                                        className="flex-1 bg-skin-fill-element border border-skin-border p-2 rounded text-xs text-skin-base placeholder:text-skin-muted/50 outline-none"
                                     />
                                     <button 
                                        onClick={handleAutoConfigure}
                                        disabled={isGeneratingPersona}
                                        className="px-4 py-2 bg-skin-fill-element border border-skin-border text-xs uppercase tracking-wider hover:bg-skin-accent hover:text-skin-fill transition-colors disabled:opacity-50 animate-border-glow"
                                        title="Auto-generate Name, Persona, and Knowledge Base"
                                     >
                                         {isGeneratingPersona ? '...' : 'Generate'}
                                     </button>
                                 </div>
                                 {personaOptions.length > 0 && (
                                     <div className="mt-4 grid grid-cols-1 gap-2">
                                         {personaOptions.map((opt, i) => (
                                             <div key={i} onClick={() => {setConfigPersona(opt.content); setPersonaOptions([]);}} className="cursor-pointer p-2 border border-skin-border rounded hover:bg-skin-fill-element">
                                                 <p className="font-bold text-xs text-skin-accent">{opt.title} <span className="text-skin-muted font-normal">({opt.tone})</span></p>
                                                 <p className="text-[10px] text-skin-muted line-clamp-2">{opt.content}</p>
                                             </div>
                                         ))}
                                     </div>
                                 )}
                              </div>

                              {/* Manual Chat Starters */}
                               <div className="pt-4 border-t border-skin-border/50">
                                 <label className="text-xs font-mono uppercase tracking-widest text-skin-muted mb-2 block">Chat Starters (Comma Separated)</label>
                                 <input 
                                    type="text" 
                                    value={chatStartersInput} 
                                    onChange={(e) => setChatStartersInput(e.target.value)}
                                    placeholder="e.g. Define X, Summarize Y, Explain Z"
                                    className="w-full bg-skin-fill-element border border-skin-border p-2 rounded text-xs text-skin-base placeholder:text-skin-muted/50 outline-none"
                                 />
                              </div>

                              <button onClick={clearChatHistory} type="button" className="w-full py-3 mt-4 border border-skin-border text-skin-accent/80 hover:text-skin-accent hover:bg-skin-fill-element transition-colors text-xs uppercase tracking-widest" title="Clear all chat history">
                                  Clear Chat History
                              </button>
                          </div>
                      )}

                      {configTab === 'knowledge' && (
                          <div className="space-y-6">
                              {/* Source Management */}
                              <div className="space-y-2">
                                  <div className="flex justify-between items-center mb-2">
                                      <h3 className="text-xs font-mono uppercase tracking-widest text-skin-muted">Loaded Sources</h3>
                                      <button 
                                        onClick={handleAutoPopulateKB} 
                                        disabled={isPopulatingKB}
                                        className="text-[10px] text-skin-accent hover:underline disabled:opacity-50"
                                        title="Generate sources from Persona"
                                      >
                                          {isPopulatingKB ? 'Populating...' : 'Auto-Populate from Persona'}
                                      </button>
                                  </div>
                                  
                                  {syllabusData.primary_sources_en.length === 0 ? (
                                      <div className="p-4 border border-dashed border-skin-border rounded text-center text-xs text-skin-muted italic">
                                          No sources loaded.
                                      </div>
                                  ) : (
                                      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                                          {syllabusData.primary_sources_en.map((src, i) => (
                                              <div key={i} className="flex justify-between items-center p-2 bg-skin-fill-element rounded border border-skin-border shadow-sm">
                                                  <div className="flex items-center gap-2 overflow-hidden">
                                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-skin-accent shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                      <span className="text-xs text-skin-base truncate">{src.text}</span>
                                                  </div>
                                                  <button onClick={() => removeSource(i)} className="text-red-400 hover:text-red-500 ml-2 p-1" title="Remove Source">✕</button>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>

                              <div className="pt-4 border-t border-skin-border/50">
                                  {!showPasteInput ? (
                                      <div className="flex gap-2">
                                         <button 
                                            onClick={() => fileUploadRef.current?.click()}
                                            className="flex-1 py-3 bg-skin-fill-element border border-skin-border text-skin-base hover:border-skin-accent transition-colors flex items-center justify-center gap-2 rounded animate-border-glow"
                                            title="Upload a text or markdown file"
                                         >
                                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                             <span className="text-xs uppercase tracking-wide">Upload File</span>
                                         </button>
                                         <input type="file" ref={fileUploadRef} onChange={handleKBFileSelect} className="hidden" accept=".txt,.md,.json" />
                                         
                                         <button 
                                            onClick={() => setShowPasteInput(true)}
                                            className="flex-1 py-3 bg-skin-fill-element border border-skin-border text-skin-base hover:border-skin-accent transition-colors flex items-center justify-center gap-2 rounded"
                                            title="Paste text directly"
                                         >
                                             <span className="text-xs uppercase tracking-wide">Paste Text</span>
                                         </button>
                                      </div>
                                  ) : (
                                      <div className="space-y-2 animate-fade-in">
                                          <textarea 
                                             value={pasteInput}
                                             onChange={(e) => setPasteInput(e.target.value)}
                                             placeholder="Paste your content here..."
                                             className="w-full h-32 bg-skin-fill-element border border-skin-border p-2 text-xs font-mono outline-none resize-none placeholder:text-skin-muted/50"
                                          />
                                          <div className="flex gap-2">
                                              <button onClick={handlePasteAnalyze} disabled={isAnalyzing} className="flex-1 bg-skin-accent text-skin-fill py-2 text-xs uppercase font-bold rounded hover:opacity-90 disabled:opacity-50 animate-border-glow">
                                                  {isAnalyzing ? 'Analyzing...' : 'Analyze & Add'}
                                              </button>
                                              <button onClick={() => setShowPasteInput(false)} className="px-3 py-2 border border-skin-border text-skin-muted hover:text-skin-base text-xs">Cancel</button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                              {isAnalyzing && <p className="text-xs text-skin-accent text-center animate-pulse">Analyzing content structure with Gemini...</p>}
                          </div>
                      )}

                      {configTab === 'connections' && (
                          <div className="space-y-6">
                              <div>
                                  <label className="text-xs font-mono uppercase tracking-widest text-skin-muted mb-2 block">Gemini API Config</label>
                                  <div className="p-3 bg-skin-fill-element border border-skin-border rounded text-xs text-skin-muted flex items-center justify-between shadow-sm">
                                      <span>Google Gemini API</span>
                                      <span className={`w-2 h-2 rounded-full ${isGeminiReady ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                                  </div>
                                  <div className="mt-2 flex justify-between items-center text-[10px]">
                                      <p className="text-skin-muted flex items-center gap-2">
                                          Status: <span className={isGeminiReady ? "text-green-400" : "text-red-400"}>{isGeminiReady ? "Configured" : "Not Configured"}</span>
                                      </p>
                                       <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-skin-accent hover:underline">Get API Key</a>
                                  </div>
                              </div>
                               <div>
                                  <label className="text-xs font-mono uppercase tracking-widest text-skin-muted mb-2 block">Custom API Key (Overrides Default)</label>
                                  <div className="flex gap-2">
                                      <input 
                                          type="text"
                                          value={userApiKey}
                                          onChange={(e) => setUserApiKeyInput(e.target.value)}
                                          placeholder="Paste your API key here"
                                          className="flex-1 bg-skin-fill-element border border-skin-border text-skin-base p-2 rounded focus:border-skin-accent outline-none font-mono text-xs"
                                      />
                                      <button
                                          onClick={handleSaveApiKey}
                                          className="px-4 py-2 bg-skin-fill-element border border-skin-border text-xs uppercase tracking-wider hover:bg-skin-accent hover:text-skin-fill transition-colors"
                                          title="Save key to local storage"
                                      >
                                          Save
                                      </button>
                                  </div>
                                   <p className="text-[10px] font-mono leading-relaxed text-skin-muted mt-2 p-3 bg-skin-fill-element border border-dashed border-skin-border/50 rounded">
                                      Your key is saved in your browser's local storage. If left empty, the application will use the default key if available.
                                  </p>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-skin-fill-panel border-t border-skin-border flex justify-between items-center">
                      <div className="flex gap-2">
                          <button onClick={handleExportConfig} className="px-3 py-1.5 border border-skin-border text-[10px] uppercase text-skin-muted hover:text-skin-base rounded transition-colors" title="Export Config JSON">Export</button>
                          <label className="px-3 py-1.5 border border-skin-border text-[10px] uppercase text-skin-muted hover:text-skin-base rounded transition-colors cursor-pointer" title="Import Config JSON">
                              Import
                              <input type="file" onChange={handleImportConfig} className="hidden" accept=".json" />
                          </label>
                      </div>
                      <div className="flex gap-3">
                          <button 
                             onClick={resetConfiguration}
                             className="text-red-400 hover:text-red-500 text-[10px] uppercase tracking-wider transition-colors mr-2"
                             title="Reset to default settings"
                          >
                              Reset Default
                          </button>
                          <button 
                             onClick={saveConfiguration}
                             className="px-6 py-2 bg-skin-accent text-skin-fill-panel font-bold uppercase tracking-widest rounded hover:shadow-lg hover:shadow-skin-accent/20 transition-all text-xs animate-border-glow"
                             title="Save all changes"
                          >
                              Save Changes
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;