import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAsahVN3b4TfA_atPtKy8d5DPaJ0819F3w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ats-1-7d621.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ats-1-7d621",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ats-1-7d621.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "331729790419",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:331729790419:web:dc5d5000bd95054c123b26",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DRJXJB5154"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Failed to set auth persistence:', err);
  });
}
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true
});
export const storage = getStorage(app);

export default app;