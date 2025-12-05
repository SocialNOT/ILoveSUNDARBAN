import { GoogleGenAI, Modality, Content, Type } from "@google/genai";
import { Attachment, ChatMessage, SyllabusData, SourcePrimary } from '../types';

const USER_API_KEY_STORAGE_KEY = 'gemini_user_api_key';

// In-memory cache to reduce localStorage access
let cachedApiKey: string | null | undefined = undefined;

const getApiKey = (): string | null => {
    if (cachedApiKey !== undefined) return cachedApiKey;

    const userKey = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
    if (userKey) {
        cachedApiKey = userKey;
        return userKey;
    }

    let envKey: string | undefined;

    // Safely check for Vite's `import.meta.env`. Vite will replace these with actual values at build time.
    // This now checks for standard VITE_ prefixed keys, and unprefixed keys exposed via vite.config.ts.
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            envKey = import.meta.env.GEMINI_API_KEY || import.meta.env.API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
        }
    } catch (e) {
        // Silently fail if import.meta.env is not available
    }
    
    if (envKey) {
        cachedApiKey = envKey;
        return envKey;
    }
    
    cachedApiKey = null;
    return null;
};

export const setUserApiKey = (key: string) => {
    if (key && key.trim()) {
        localStorage.setItem(USER_API_KEY_STORAGE_KEY, key);
        cachedApiKey = key;
    } else {
        localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
        cachedApiKey = undefined; // Reset cache to force re-evaluation (fallback to env)
    }
};

export const getUserApiKey = (): string => {
    return localStorage.getItem(USER_API_KEY_STORAGE_KEY) || '';
};

export const isGeminiConfigured = (): boolean => {
    return !!getApiKey();
};

const initializeAI = (): GoogleGenAI => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please add one in the Agent Console > Connections tab.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper: Convert ChatMessage[] to Gemini Content[]
// SMART CONTEXT LOGIC: Truncate history to avoid token limits
const formatHistory = (messages: ChatMessage[]): Content[] => {
  // Keep only the last 15 messages to prevent context overflow
  // This ensures the System Instruction (Persona) always takes precedence
  const recentMessages = messages.slice(-15);
  
  return recentMessages.map(m => {
    const parts: any[] = [{ text: m.text }];
    if (m.attachments) {
      m.attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }
    return {
      role: m.role,
      parts: parts
    };
  });
};

export interface ChatOptions {
  useThinking?: boolean;
  useSearch?: boolean;
  searchFocus?: string;
}

export interface PersonaVariation {
  title: string;
  tone: string;
  content: string;
}

export const generatePersonaVariations = async (description: string): Promise<PersonaVariation[]> => {
  const client = initializeAI();

  const prompt = `
    Based on this user description: "${description}", generate 3 distinct System Persona variations for an AI Assistant.
    
    1. Variation 1: Balanced/Helpful (Standard interpretation)
    2. Variation 2: Strict/Academic (Formal, concise, expert)
    3. Variation 3: Socratic/Creative (Engaging, asks questions, illustrative)

    Return a JSON object containing an array of variations. Each variation must have a 'title' (short name), 'tone' (1-2 words), and 'content' (the actual system instruction text, approx 100 words).
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  tone: { type: Type.STRING },
                  content: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.variations || [];
  } catch (error) {
    console.error("Persona generation failed", error);
    throw error;
  }
};

export const generatePersonaDraft = async (description: string): Promise<string> => {
  const client = initializeAI();

  const prompt = `
    Create a detailed System Persona/System Instruction for an AI Assistant based on this description:
    "${description}"

    The persona should define:
    1. Core Identity & Role
    2. Goal/Objective
    3. Tone & Style
    4. Operational Rules (what to do/not do)

    Keep it concise but effective (approx 100-150 words).
    Return ONLY the persona text, no conversational filler.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    return response.text || "";
  } catch (error) {
    console.error("Persona generation failed", error);
    throw error;
  }
};

export const generateSyllabusFromPersona = async (personaText: string): Promise<SyllabusData> => {
  const client = initializeAI();

  const prompt = `
    Based on the following AI Persona, generate a structured Knowledge Base (Syllabus) that this persona would likely reference or study.
    
    PERSONA:
    "${personaText}"

    TASKS:
    1. Create a "Project Title" relevant to this persona's field.
    2. Identify the "Core Concept" they specialize in.
    3. List 3-5 "Primary Sources" (Real books, papers, or foundational texts) that are authoritative in this field.
    4. List 3-5 "Secondary Sources" (Prominent scholars or experts).
    5. List 5-8 "Key Terms" relevant to the field.
    6. Generate 4 "Suggested Queries" (Chat Starters). They must be VERY SHORT, concise one-liners (max 6 words) that act as quick hooks.

    Return as JSON matching the SyllabusData structure.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            project_title: { type: Type.STRING },
            core_concept: { type: Type.STRING },
            primary_sources_en: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  author: { type: Type.STRING },
                  concept_focus: { type: Type.STRING }
                }
              }
            },
            secondary_sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  author: { type: Type.STRING },
                  focus: { type: Type.STRING }
                }
              }
            },
            key_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggested_queries: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
        project_title: result.project_title || "Custom Assistant",
        core_concept: result.core_concept || "General",
        primary_sources_en: result.primary_sources_en || [],
        primary_sources_bn: [],
        secondary_sources: result.secondary_sources || [],
        key_terms: result.key_terms || [],
        suggested_queries: result.suggested_queries || []
    };
  } catch (error) {
    console.error("Syllabus auto-generation failed", error);
    throw error;
  }
};

export const generateAppConfiguration = async (description: string): Promise<{appName: string, persona: string, syllabus: SyllabusData}> => {
  const client = initializeAI();

  const prompt = `
    Based on this description: "${description}", configure a complete AI Agent.
    
    1. Name: A creative name for the agent (App Name).
    2. Persona: A detailed system instruction defining its role, tone, and goals.
    3. Syllabus: A knowledge base structure including Project Title, Core Concept, 3 Primary Sources, 3 Secondary Sources, 5 Key Terms, and 4 short Chat Starters.

    Return JSON.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            appName: { type: Type.STRING },
            persona: { type: Type.STRING },
            syllabus: {
                type: Type.OBJECT,
                properties: {
                    project_title: { type: Type.STRING },
                    core_concept: { type: Type.STRING },
                    primary_sources_en: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                author: { type: Type.STRING },
                                concept_focus: { type: Type.STRING }
                            }
                        }
                    },
                    secondary_sources: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                author: { type: Type.STRING },
                                focus: { type: Type.STRING }
                            }
                        }
                    },
                    key_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggested_queries: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    const safeSyllabus: SyllabusData = {
        project_title: result.syllabus?.project_title || "New Project",
        core_concept: result.syllabus?.core_concept || "General",
        primary_sources_en: result.syllabus?.primary_sources_en || [],
        primary_sources_bn: [],
        secondary_sources: result.syllabus?.secondary_sources || [],
        key_terms: result.syllabus?.key_terms || [],
        suggested_queries: result.syllabus?.suggested_queries || []
    };

    return {
        appName: result.appName || "New Agent",
        persona: result.persona || "You are a helpful assistant.",
        syllabus: safeSyllabus
    };

  } catch (error) {
    console.error("Auto-configuration failed", error);
    throw error;
  }
};

export const analyzeKnowledgeBase = async (fileContent: string): Promise<Partial<SyllabusData>> => {
  const client = initializeAI();

  const prompt = `
    Analyze the provided document content. 
    1. Identify a suitable Project Title and the Core Concept being discussed.
    2. Identify if this document represents a Primary Source (e.g., a specific book, article, paper). Return its title, author, and main focus.
    3. Identify important Key Terms defined or discussed in the text.
    4. Identify any Secondary Sources (other scholars or works) referenced significantly.
    
    Return the result as a valid JSON object matching the requested schema.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
          prompt,
          `DOCUMENT CONTENT (Snippet):\n${fileContent.substring(0, 30000)}...` // Send first 30k chars for analysis to be safe on tokens, usually enough for metadata
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            project_title: { type: Type.STRING },
            core_concept: { type: Type.STRING },
            primary_sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "Title of the primary source text" },
                  author: { type: Type.STRING },
                  concept_focus: { type: Type.STRING, description: "Brief focus of this text" }
                }
              }
            },
            secondary_sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  author: { type: Type.STRING },
                  focus: { type: Type.STRING }
                }
              }
            },
            key_terms: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // Map JSON result to SyllabusData structure
    // We map the analyzed 'primary_sources' to 'primary_sources_en'
    return {
      project_title: result.project_title || "New Project",
      core_concept: result.core_concept || "General Analysis",
      primary_sources_en: result.primary_sources || [],
      secondary_sources: result.secondary_sources || [],
      key_terms: result.key_terms || []
    };

  } catch (error) {
    console.error("Analysis failed", error);
    // Fallback if analysis fails
    return {
      project_title: "Uploaded Knowledge Base",
      core_concept: "Document Analysis",
      primary_sources_en: [{ text: "Uploaded Document", concept_focus: "General Content" }],
      key_terms: []
    };
  }
};

export const streamChatResponse = async (
  history: ChatMessage[],
  newMessage: string,
  attachments: Attachment[],
  options: ChatOptions,
  systemInstruction: string,
  knowledgeBase: SyllabusData,
  onChunk: (text: string) => void
): Promise<string> => {
  const client = initializeAI();

  // Determine Model
  let modelName = 'gemini-2.5-flash';
  if (options.useThinking) {
    modelName = 'gemini-3-pro-preview';
  }

  // Construct Context from Knowledge Base
  let contextString = "";
  // Aggregate content from primary sources
  knowledgeBase.primary_sources_en.forEach(source => {
    if (source.content) {
      contextString += `\n\n--- SOURCE: ${source.text} ---\n${source.content}\n`;
    }
  });
  
  // If we have context, prepend it to the system instruction or handle it carefully
  const effectiveSystemInstruction = `
${systemInstruction}

${options.searchFocus ? `\n\nIMPORTANT SEARCH INSTRUCTION: The user has requested to restrict or focus Google Searches on: "${options.searchFocus}". Please try to use "site:${options.searchFocus}" or similar constraints in your search tool calls if appropriate.` : ""}

${contextString ? `\n\n### REFERENCE KNOWLEDGE BASE:\n${contextString}` : ""}
`;

  // Construct Config
  const config: any = {
    systemInstruction: effectiveSystemInstruction,
    temperature: options.useThinking ? 0.7 : 0.3, 
  };

  if (options.useThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 }; 
  }

  if (options.useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  // Build Contents (History + New Message)
  const pastContent = formatHistory(history);
  
  const newParts: any[] = [{ text: newMessage }];
  if (attachments && attachments.length > 0) {
    attachments.forEach(att => {
      newParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });
  }

  const contents = [...pastContent, { role: 'user', parts: newParts }];

  try {
    const resultStream = await client.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: config
    });

    let fullText = "";
    for await (const chunk of resultStream) {
      const chunkText = chunk.text || "";
      fullText += chunkText;
      onChunk(fullText);
    }
    return fullText;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};

export const translateText = async (text: string): Promise<string> => {
    const client = initializeAI();
    
    // Detect if text is mostly Bengali or English roughly, but easier to just ask the model to toggle
    const prompt = `Translate the following text. If it is in English, translate to Bengali. If it is in Bengali, translate to English. Maintain professional/scholarly tone.\n\nTEXT:\n${text}`;

    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return response.text || text;
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/wav'): Promise<string> => {
  const client = initializeAI();

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { inlineData: { mimeType: mimeType, data: audioBase64 } },
      { text: "Transcribe the spoken audio exactly. Return only the text." }
    ]
  });

  return response.text || "";
};

// FIX: Added helper functions for audio processing. This resolves errors in this file and in ChatConsole.tsx.
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export async function decodeAudioData(
  data: ArrayBuffer,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const dataUint8 = new Uint8Array(data);
  const dataInt16 = new Int16Array(dataUint8.buffer);
  const numChannels = 1; // Mono
  const sampleRate = 24000; // As per Gemini TTS
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  const client = initializeAI();

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, 
        },
      },
    },
  });

  // FIX: Robustly find the audio data by iterating through the response parts.
  let base64Audio: string | undefined;
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          break; // Found audio data, exit loop
        }
      }
    }
  }
  
  if (base64Audio) {
      const audioBytes = decode(base64Audio);
      // FIX: Cast ArrayBufferLike to ArrayBuffer to satisfy TypeScript strictness
      return audioBytes.buffer as ArrayBuffer;
  }

  throw new Error("No audio data received from Gemini API.");
};