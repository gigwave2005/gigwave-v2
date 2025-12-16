// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  auth,
  db,
  googleProvider,
  facebookProvider,
  instagramProvider,
} from "../config/firebase";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // firebase user
  const [userProfile, setUserProfile] = useState(null); // our user doc + optional artistProfile
  const [loading, setLoading] = useState(true);

  // 🔹 Fetch or create user profile doc after auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setCurrentUser(fbUser);

      if (!fbUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", fbUser.uid);
        const snap = await getDoc(userRef);

        let baseProfile = null;

        if (snap.exists()) {
          baseProfile = snap.data();
        } else {
          // Fallback: minimal profile if not yet created
          baseProfile = {
            email: fbUser.email,
            userType: "audience", // default; we’ll set explicitly on signup
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            phoneNumber: fbUser.phoneNumber || null,
            phoneLoginEnabled: false, // for future OTP
          };
          await setDoc(userRef, baseProfile);
        }

        // If user is an artist (according to users/{uid}.userType),
        // also try to load /artists/{uid} and attach it to userProfile.
        let artistProfile = null;
        try {
          if (baseProfile?.userType === "artist") {
            const artistRef = doc(db, "artists", fbUser.uid);
            const artistSnap = await getDoc(artistRef);
            if (artistSnap.exists()) {
              artistProfile = artistSnap.data();
            } else {
              // No artist doc yet — we don't create one here automatically,
              // because artist signup flow should have created it. Keep null.
              artistProfile = null;
            }
          }
        } catch (err) {
          console.warn("Error fetching artist profile:", err);
          artistProfile = null;
        }

        // Compose combined profile object
        const composed = {
          ...baseProfile,
          // attach artistProfile only if present
          ...(artistProfile ? { artistProfile } : {}),
        };

        setUserProfile(composed);
      } catch (err) {
        console.error("Error loading user profile:", err);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // 🔹 Email sign up (artist or audience)
  const signUpWithEmail = async ({ email, password, userType }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, "users", cred.user.uid);

    await setDoc(
      userRef,
      {
        email,
        userType, // "artist" | "audience"
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        phoneNumber: null,
        phoneLoginEnabled: false,
      },
      { merge: true }
    );

    // If artist signup: create minimal artists/{uid} doc so app knows artist exists
    if (userType === "artist") {
      const artistRef = doc(db, "artists", cred.user.uid);
      await setDoc(
        artistRef,
        {
          profileCompleted: false,
          createdAt: serverTimestamp(),
          // keep room for fields to be filled by profile setup UI
          displayName: null,
          genre: null,
          city: null,
          bio: null,
        },
        { merge: true }
      );
    }

    // 🔥 Send email verification only for Artists
    if (userType === "artist" && cred.user && !cred.user.emailVerified) {
      try {
        await sendEmailVerification(cred.user);
        console.log("Verification email sent");
      } catch (err) {
        console.error("Error sending verification email", err);
      }
    }

    // update local userProfile cache (best-effort, actual onAuthStateChanged will refresh it)
    setUserProfile((prev) => ({
      ...(prev || {}),
      email,
      userType,
      // if artist, include an artistProfile minimal object
      ...(userType === "artist"
        ? {
            artistProfile: {
              profileCompleted: false,
              createdAt: serverTimestamp(),
              displayName: null,
              genre: null,
              city: null,
              bio: null,
            },
          }
        : {}),
    }));

    return cred.user;
  };

  // 🔹 Email sign in with optional remember flag (default: true)
  // Usage: signInWithEmail(email, password)  -> remembers by default
  //        signInWithEmail(email, password, false) -> session-only
  const signInWithEmail = async (email, password, remember = true) => {
    // set persistence based on remember flag
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );
    } catch (err) {
      // if setting persistence fails, continue to attempt sign-in
      console.warn("Could not set persistence, proceeding to sign in:", err);
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  // 🔹 Social login helper — accepts optional remember flag
  const signInWithProvider = async (provider, userTypeHint, remember = true) => {
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );
    } catch (err) {
      console.warn("Could not set persistence for provider sign-in:", err);
    }

    const cred = await signInWithPopup(auth, provider);
    const userRef = doc(db, "users", cred.user.uid);
    const existing = await getDoc(userRef);

    if (!existing.exists()) {
      // If app provided a userTypeHint (e.g. "artist"), use it; otherwise default to audience
      const finalUserType = userTypeHint || "audience";
      await setDoc(userRef, {
        email: cred.user.email,
        userType: finalUserType,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        phoneNumber: cred.user.phoneNumber || null,
        phoneLoginEnabled: false,
      });

      // If hinted artist, create minimal artists doc
      if (finalUserType === "artist") {
        const artistRef = doc(db, "artists", cred.user.uid);
        await setDoc(
          artistRef,
          {
            profileCompleted: false,
            createdAt: serverTimestamp(),
            displayName: cred.user.displayName || null,
            genre: null,
            city: null,
            bio: null,
          },
          { merge: true }
        );
      }
    } else {
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    }

    return cred.user;
  };

  const signInWithGoogle = (userTypeHint, remember = true) =>
    signInWithProvider(googleProvider, userTypeHint, remember);

  const signInWithFacebook = (userTypeHint, remember = true) =>
    signInWithProvider(facebookProvider, userTypeHint, remember);

  // 🔹 Instagram – frontend placeholder. Will only work once provider is configured.
  const signInWithInstagram = (userTypeHint, remember = true) =>
    signInWithProvider(instagramProvider, userTypeHint, remember);

  // 🔹 Forgot password
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  // 🔹 Logout
  const logout = () => signOut(auth);

  const value = {
    currentUser,
    userProfile, // includes userType etc. + artistProfile if present
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    signInWithInstagram,
    resetPassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
