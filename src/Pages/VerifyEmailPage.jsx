// src/Pages/VerifyEmailPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../config/firebase";

function VerifyEmailPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [reloading, setReloading] = useState(false);

  // Gate: must be logged-in artist. If already verified, bounce to home.
  useEffect(() => {
    if (!currentUser) {
      navigate("/signin");
      return;
    }
    if (userProfile?.userType !== "artist") {
      navigate("/");
      return;
    }
    if (currentUser.emailVerified) {
      navigate("/");
    }
  }, [currentUser, userProfile, navigate]);

  const handleResend = async () => {
    setError("");
    setInfo("");
    if (!currentUser) return;
    setSending(true);
    try {
      await sendEmailVerification(currentUser);
      setInfo("Verification email sent again. Please check your inbox.");
    } catch (err) {
      console.error("Error sending verification email", err);
      setError("Could not resend email. Please try again later.");
    } finally {
      setSending(false);
    }
  };

  const handleRefreshStatus = async () => {
    setError("");
    setInfo("");
    if (!auth.currentUser) return;
    setReloading(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setInfo("Email verified! Redirecting…");
        navigate("/");
      } else {
        setInfo("Still not verified. Please click the link in your email.");
      }
    } catch (err) {
      console.error("Error reloading user", err);
      setError("Could not refresh status. Try again.");
    } finally {
      setReloading(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 600 }}>
      <h2>Verify your email</h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
        We’ve sent a verification email to{" "}
        <strong>{currentUser.email}</strong>. Please click the link in that
        email to verify your account. Once verified, you’ll be able to access
        your full artist dashboard.
      </p>

      {info && (
        <p style={{ fontSize: 13, color: "green", marginBottom: 8 }}>{info}</p>
      )}
      {error && (
        <p style={{ fontSize: 13, color: "red", marginBottom: 8 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={handleResend}
          disabled={sending}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {sending ? "Sending…" : "Resend email"}
        </button>

        <button
          onClick={handleRefreshStatus}
          disabled={reloading}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {reloading ? "Checking…" : "I’ve verified – refresh status"}
        </button>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
