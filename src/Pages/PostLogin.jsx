// src/Pages/PostLogin.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";

/**
 * Centralized post-sign-in router.
 *
 * Expectation:
 * - SignInPage (and social sign-ins) should navigate to "/post-login"
 *   with `state: { redirectTo, mode }`
 *
 * Behavior:
 * 1. If redirectTo present -> navigate(redirectTo)
 * 2. Else if mode === "artist" -> route artist flow:
 *      a) If currentUser.emailVerified === false -> /verify-email
 *      b) If /artists/{uid} exists and profileCompleted === true -> /artist/gigs
 *      c) Otherwise -> /artist/profile-setup
 * 3. Else -> navigate("/gigs")
 */
export default function PostLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, loading } = useAuth();

  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("Finishing sign-in…");

  // state passed from SignInPage: { redirectTo, mode }
  const redirectTo = location.state?.redirectTo || null;
  const mode = location.state?.mode || null;

  useEffect(() => {
    let mounted = true;

    const decide = async () => {
      // Wait until auth context finished initialization
      if (loading) return;

      // If no firebase user, send to signin (safe fallback)
      if (!currentUser) {
        navigate("/signin", { replace: true });
        return;
      }

      // 1) explicit redirect takes highest priority
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
        return;
      }

      // 2) artist flow if requested OR if userProfile indicates artist
      const wantsArtist = mode === "artist" || userProfile?.userType === "artist";

      if (wantsArtist) {
        // if email not verified, send to verify-email first
        if (currentUser && currentUser.email && !currentUser.emailVerified) {
          navigate("/verify-email", { replace: true });
          return;
        }

        // try to use cached artistProfile in userProfile if available
        const cachedArtist = userProfile?.artistProfile || null;

        if (cachedArtist) {
          if (cachedArtist.profileCompleted) {
            navigate("/artist/dashboard", { replace: true });
            return;
          } else {
            navigate("/artist/profile-setup", { replace: true });
            return;
          }
        }

        // fallback: fetch /artists/{uid} doc directly
        try {
          setMessage("Checking artist profile…");
          const artistRef = doc(db, "artists", currentUser.uid);
          const snap = await getDoc(artistRef);
          if (!mounted) return;

          if (snap.exists()) {
            const data = snap.data();
            if (data?.profileCompleted) {
              navigate("/artist/dashooard", { replace: true });
              return;
            } else {
              navigate("/artist/profile-setup", { replace: true });
              return;
            }
          } else {
            // artist doc not found -> go to profile setup (this will create artist doc)
            navigate("/artist/profile-setup", { replace: true });
            return;
          }
        } catch (err) {
          console.error("PostLogin: error checking artist doc", err);
          // On error, fallback to profile-setup so user can create artist profile
          navigate("/artist/profile-setup", { replace: true });
          return;
        }
      }

      // 3) default audience flow
      navigate("/gigs", { replace: true });
    };

    decide().finally(() => {
      if (mounted) setBusy(false);
    });

    return () => {
      mounted = false;
    };
  }, [currentUser, userProfile, loading, navigate, redirectTo, mode]);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        padding: 16,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 12, fontSize: 18, fontWeight: 700 }}>{message}</div>
        <div style={{ opacity: 0.85, fontSize: 14 }}>
          {busy ? "Redirecting…" : "If you are not redirected automatically, click below."}
        </div>

        {!busy && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                if (userProfile?.userType === "artist") {
                  navigate("/artist/gigs", { replace: true });
                } else {
                  navigate("/gigs", { replace: true });
                }
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "white",
                cursor: "pointer",
              }}
            >
              Go now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
