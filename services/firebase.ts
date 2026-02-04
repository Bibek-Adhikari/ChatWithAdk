import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const getEnv = (key: string) => {
  const val = import.meta.env[key];
  if (val) return val;
  
  // Deployment check
  if (typeof window !== 'undefined') {
    return (window as any)._env_?.[key] || "";
  }
  return "";
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Defensive check to prevent crash if config is missing
const isFirebaseConfigured = !!firebaseConfig.apiKey;

let app;
try {
  if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully.");
  } else {
    console.warn("Firebase configuration is missing. Authentication features will be disabled.");
    // Initialize with empty config to prevent downstream crashes, or handle null auth
    app = initializeApp({ apiKey: "none" }); 
  }
} catch (error) {
  console.error("Firebase failed to initialize:", error);
  app = initializeApp({ apiKey: "none" });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
