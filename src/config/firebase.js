// src/config/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCsGfTHzvQdt6rpD4IUEZ9nXMJZH-1CuFA",
  authDomain: "gigwave-v2.firebaseapp.com",
  projectId: "gigwave-v2",
  storageBucket: "gigwave-v2.firebasestorage.app",
  messagingSenderId: "454936474664",
  appId: "1:454936474664:web:49a9d01384599c9c5d711d",
  measurementId: "G-L9JQWW0ZGT",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Core services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// 🔥 CONNECT AUTH EMULATOR (DEV ONLY)
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://localhost:9099", {
    disableWarnings: true,
  });
}

// Auth providers
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
export const instagramProvider = new OAuthProvider("instagram.com");

