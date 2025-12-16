// src/Pages/SignInPage.jsx
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function SignInPage() {
  const {
    signInWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    signInWithInstagram,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true); // Remember Me enabled by default
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.redirectTo || null;
  const mode = location.state?.mode || null; // "artist" or undefined
  const isArtistMode = mode === "artist";

  // After successful sign-in, hand off to centralized post-login router
  const finishSignIn = () => {
    navigate("/post-login", {
      replace: true,
      state: { redirectTo: redirectTo || null, mode: mode || null },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // signInWithEmail(email, password, remember)
      await signInWithEmail(email.trim(), password, rememberMe);
      finishSignIn();
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err?.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (providerFn) => {
    setError("");
    setLoading(true);
    try {
      // Our social helpers accept (userTypeHint?, remember?)
      // We don't pass a userTypeHint here (frontend could pass "artist" if desired)
      await providerFn(undefined, rememberMe);
      finishSignIn();
    } catch (err) {
      console.error("Social sign in error:", err);
      setError(err?.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="landing-bg">
    <div className="landing-overlay">

      {/* LOGO */}
      <h1 className="logo-animated">GigWave</h1>

      {/* TAGLINE – WAVE */}
      <h2 className="tagline-wave">
        Ride The Wave Of Live Music
      </h2>

      {/* SUB LINE – FIRE */}
      <p className="tagline-fire">
        Discover Live Music Near You
      </p>

      {/* AUTH CARD */}
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>

        {/* MODE INDICATOR */}
        {isArtistMode && (
          <div style={{ marginBottom: 10 }}>
            <span className="live-badge">🎤 Artist Mode</span>
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 10,
              padding: 8,
              borderRadius: 8,
              fontSize: 12,
              background: "rgba(255,50,80,0.15)",
              border: "1px solid rgba(255,80,120,0.6)",
            }}
          >
            {error}
          </div>
        )}

        {/* EMAIL / PASSWORD */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />


          <input
            type="password"
            placeholder="Password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 12 }}
          />

          {/* REMEMBER / FORGOT */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              fontSize: 12,
            }}
          >
            <label style={{ display: "flex", gap: 6 }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember Me
            </label>

            <Link to="/forgot-password" style={{ color: "var(--color-electric-blue)" }}>
              Forgot Password?
            </Link>
          </div>

          {/* CTA */}
          <button
            type="submit"
            className={`btn-primary ${loading ? "btn-disabled" : ""}`}
            style={{ width: "100%", marginTop: 16 }}
            disabled={loading}
          >
            {loading ? "Entering The Gig…" : "Enter The Gig"}
          </button>
        </form>

        {/* DIVIDER */}
        <div style={{ margin: "16px 0", opacity: 0.6, fontSize: 11, textAlign: "center" }}>
          — Or Continue With —
        </div>

        {/* SOCIAL (DEV NOTE: Can be hidden later) */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => handleSocialSignIn(signInWithGoogle)}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => handleSocialSignIn(signInWithFacebook)}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Facebook
          </button>
          <button
            type="button"
            onClick={() => handleSocialSignIn(signInWithInstagram)}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Instagram
          </button>
        </div>

        {/* SIGN UP */}
        <div style={{ marginTop: 14, fontSize: 12, textAlign: "center" }}>
          Don&apos;t Have An Account?{" "}
          <Link
            to="/signup"
            state={isArtistMode ? { mode: "artist" } : undefined}
            style={{ color: "var(--color-neon-pink)", fontWeight: 600 }}
          >
            Create One
          </Link>
        </div>

      </div>
    </div>
  </div>
);
}

export default SignInPage;
