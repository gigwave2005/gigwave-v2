// src/Pages/ForgotPasswordPage.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await resetPassword(email);
      setMessage("Password reset email sent if the account exists.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not send reset email.");
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h2>Reset Password</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", marginBottom: 4 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <button
          type="submit"
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          Send Reset Link
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;
