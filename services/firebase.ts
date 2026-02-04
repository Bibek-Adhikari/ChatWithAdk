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
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase API Key is MISSING. Ensure VITE_FIREBASE_API_KEY is set in Netlify Environment Variables.");
} else {
  console.log("Firebase initialized successfully.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
