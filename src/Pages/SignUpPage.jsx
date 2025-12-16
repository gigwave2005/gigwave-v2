// src/Pages/SignUpPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

function SignUpPage() {
  const {
    signUpWithEmail,
    signInWithGoogle,
    signInWithFacebook,
    signInWithInstagram,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("artist");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const redirectAfterAuth = () => {
    if (userType === "artist") {
      navigate("/artist/profile-setup");
    } else {
      navigate("/gigs");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await signUpWithEmail({ email, password, userType });
      redirectAfterAuth();
    } catch (err) {
      setError(
        err.code === "auth/email-already-in-use"
          ? "This email already has an account. Try signing in."
          : err.message || "Could not sign up."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSocialSignUp = async (providerFn) => {
    setError("");
    try {
      await providerFn(userType);
      redirectAfterAuth();
    } catch (err) {
      setError(err.message || "Could not sign in.");
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-overlay">
        <div className="auth-card glass-card">

          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">
            Ride the Wave of Live Music
          </p>

          {/* Role Toggle */}
          <div className="role-toggle">
            <button
              className={userType === "artist" ? "active" : ""}
              onClick={() => setUserType("artist")}
            >
              Artist
            </button>
            <button
              className={userType === "audience" ? "active" : ""}
              onClick={() => setUserType("audience")}
            >
              Audience
            </button>
          </div>

          {/* Error */}
          {error && <div className="auth-error">{error}</div>}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              className="btn-gradient"
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="divider">OR</div>

          {/* Social */}
          <div className="social-row">
            <button onClick={() => handleSocialSignUp(signInWithGoogle)}>
              Google
            </button>
            <button disabled>Facebook</button>
            <button disabled>Instagram</button>
          </div>

          <p className="auth-footer">
            Already have an account?
            <span onClick={() => navigate("/signin")}> Sign in</span>
          </p>

        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
