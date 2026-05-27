// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCuZ6NLOE7wo6Kopyqed7HZv6Uo6fFVnTI',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'biyahe-ecf89.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'biyahe-ecf89',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'biyahe-ecf89.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '859007631448',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:859007631448:web:9fc0f5d9dfaa51ff8b8a2d',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-QHTMMDRK38'
};

// Initialize Firebase lazily/safely (SSR/Build Friendly)
let app: any = null;
let auth: Auth = null as any;
let db: Firestore = null as any;
let googleProvider: GoogleAuthProvider = null as any;

if (typeof window !== 'undefined' || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} else {
  console.warn('Firebase API key is missing. Firebase initialization skipped. This is normal during Docker build.');
}

export { app, auth, db, googleProvider };
