
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, Firestore } from "firebase/firestore";
import { getAuth, signInAnonymously, Auth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getAnalytics, Analytics } from "firebase/analytics";
import { ChatMessage, SavedState, SyllabusData, Theme, ThemeMode, UserProfile } from "../types";

let db: Firestore | null = null;
let analytics: Analytics | null = null;
let auth: Auth | null = null;

// Default Configuration provided by I💚Sundarban
const DEFAULT_CONFIG = {
  apiKey: "AIzaSyBuC9Nh7Fq-iruz4_BGn_v7xevwLJghyz8",
  authDomain: "i-love-sundarban.firebaseapp.com",
  projectId: "i-love-sundarban",
  storageBucket: "i-love-sundarban.firebasestorage.app",
  messagingSenderId: "495951533664",
  appId: "1:495951533664:web:dc27c65b0d396286639505",
  measurementId: "G-CJ4B6YZ9NC"
};

export const initializeFirebase = async (): Promise<boolean> => {
  try {
    const config = DEFAULT_CONFIG;
    let app: FirebaseApp;
    
    // If an app already exists, utilize it
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
       app = getApps()[0];
    }

    db = getFirestore(app);
    auth = getAuth(app);
    
    // Perform Anonymous Sign In to satisfy security rules (allow write if request.auth != null)
    try {
        await signInAnonymously(auth);
        console.log("Firebase initialized & Authenticated anonymously");
    } catch (authErr: any) {
         // Gracefully handle auth failures without crashing the app or logging scary errors for known issues
         const code = authErr.code;
         if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed' || code === 'auth/internal-error') {
             console.warn("Firebase Cloud Sync Warning: Authentication failed. This is likely because 'Anonymous Sign-in' is disabled in the Firebase Console or the API Key is restricted. Cloud features will be disabled.");
         } else {
             console.warn("Firebase Auth Failed:", authErr.message);
         }
         return false;
    }
    
    // Only init analytics in browser environment, safely wrap to prevent AdBlocker crashes
    if (typeof window !== 'undefined' && !analytics) {
      try {
        analytics = getAnalytics(app);
      } catch (analyticsErr) {
        console.warn("Firebase Analytics could not be initialized (likely blocked by client):", analyticsErr);
      }
    }
    return true;
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    return false;
  }
};

export const signInWithGoogle = async (): Promise<UserProfile | null> => {
  // Ensure auth is initialized
  if (!auth) {
      const success = await initializeFirebase();
      if (!success && !auth) return null;
  }
  
  if (!auth) return null;

  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    return {
      name: user.displayName || "Google User",
      email: user.email || "",
      mobile: user.phoneNumber || "",
      registeredAt: Date.now()
    };
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    return null;
  }
};

export const signOutUser = async () => {
    if (auth) {
        try {
            await signOut(auth);
            console.log("User signed out from Firebase.");
        } catch (error) {
            console.error("Firebase sign out error:", error);
        }
    }
};

export const saveSession = async (
  sessionId: string,
  state: {
    appName: string;
    persona: string;
    syllabusData: SyllabusData;
    messages: ChatMessage[];
    theme: Theme;
    mode: ThemeMode;
  }
) => {
  if (!db || !auth?.currentUser) return; // Don't try to save if not auth'd

  try {
    // Serialize messages (convert Dates to ISO strings or timestamps)
    const serializedMessages = state.messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.getTime(),
      isStreaming: false // Never save streaming state
    }));

    await setDoc(doc(db, "sessions", sessionId), {
      ...state,
      messages: serializedMessages,
      lastUpdated: Date.now()
    }, { merge: true });
    
  } catch (e: any) {
    if (e.code === 'permission-denied') {
        console.warn("Firebase Permission Denied: Check Firestore Security Rules.");
    } else {
        console.error("Error saving session to Firebase:", e);
    }
  }
};

export const loadSession = async (sessionId: string): Promise<Partial<SavedState> | null> => {
  if (!db || !auth?.currentUser) return null;

  try {
    const docRef = doc(db, "sessions", sessionId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as SavedState;
    } else {
      return null;
    }
  } catch (e: any) {
    if (e.code === 'permission-denied') {
        console.warn("Firebase Permission Denied: Unable to load session.");
    } else {
        console.error("Error loading session:", e);
    }
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<boolean> => {
  if (!db || !auth?.currentUser) return false;
  
  try {
    // Use email as doc ID if valid, else fallback to random or mobile
    const docId = profile.email.replace(/[^a-zA-Z0-9]/g, '_') || profile.mobile || 'unknown_user';
    await setDoc(doc(db, "users", docId), profile, { merge: true });
    return true;
  } catch (e) {
    console.error("Error saving user profile to Firebase:", e);
    return false;
  }
};