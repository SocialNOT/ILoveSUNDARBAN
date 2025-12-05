import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage, SavedState, SyllabusData, Theme, ThemeMode, UserProfile } from '../types';

let supabase: SupabaseClient | null = null;

// Helper to safely access env vars
const getEnv = (key: string): string | undefined => {
  let envValue: string | undefined;

  // Safely check for Vite's `import.meta.env`
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      envValue = import.meta.env[key];
    }
  } catch (e) {
    // Silently fail
  }

  // Safely check for a node-like `process.env`
  try {
    // @ts-ignore
    if (!envValue && typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      envValue = process.env[key];
    }
  } catch (e) {
    // Silently fail
  }

  return envValue;
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

export const initializeSupabase = () => {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase initialized");
      return true;
    } catch (e) {
      console.error("Supabase init failed", e);
      return false;
    }
  }
  return !!supabase;
};

export const saveUserProfileToSupabase = async (profile: UserProfile) => {
  if (!supabase) return;
  
  try {
    const { error } = await supabase
      .from('User') 
      .upsert({
        email: profile.email,
        name: profile.name,
        mobile: profile.mobile,
        registeredAt: new Date(profile.registeredAt).toISOString()
      }, { onConflict: 'email' });

    if (error) throw error;
  } catch (e) {
    console.error("Supabase Save User Error:", e);
  }
};

export const saveSessionToSupabase = async (
  sessionId: string,
  state: Partial<SavedState>
) => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('Session') 
      .upsert({
        id: sessionId,
        appName: state.appName,
        persona: state.persona,
        syllabusData: state.syllabusData,
        messages: state.messages, 
        theme: state.theme,
        mode: state.mode,
        lastUpdated: new Date(state.lastUpdated || Date.now()).toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
  } catch (e) {
    console.error("Supabase Save Session Error:", e);
  }
};

export const loadSessionFromSupabase = async (sessionId: string): Promise<Partial<SavedState> | null> => {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('Session')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // "The result contains 0 rows"
            return null; // This is not a real error, just means no session found
        }
        throw error;
    }

    if (data) {
        return {
            appName: data.appName,
            persona: data.persona,
            syllabusData: data.syllabusData,
            messages: data.messages,
            theme: data.theme,
            mode: data.mode,
            lastUpdated: new Date(data.lastUpdated).getTime()
        } as SavedState;
    }
    return null;
  } catch (e) {
    console.error("Supabase Load Session Error:", e);
    return null;
  }
};