// src/Pages/ArtistDashboard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import BottomNav from "../components/BottomNav";

const ArtistDashboard = () => {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#06000D,#170022,#270036)",
          color: "white",
          fontFamily: "system-ui",
          padding: 16,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Artist Dashboard</h1>
        <p>You need to sign in as an artist to access this area.</p>
      </div>
    );
  }

  const displayName = currentUser.displayName || currentUser.email || "Artist";

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#06000D,#170022,#270036)",
          color: "white",
          fontFamily: "system-ui",
          padding: 16,
          paddingBottom: 72,
        }}
      >
        {/* Header */}
        <div
          style={{
            borderRadius: 24,
            padding: 16,
            marginBottom: 16,
            background: "rgba(5,5,20,0.95)",
            border: "1px solid rgba(129,140,248,0.7)",
            boxShadow: "0 0 18px rgba(129,140,248,0.6)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.8,
                }}
              >
                Artist dashboard
              </p>
              <h1
                style={{
                  margin: 0,
                  marginTop: 4,
                  fontSize: 22,
                  fontWeight: 800,
                  textShadow: "0 0 10px rgba(129,140,248,0.9)",
                }}
              >
                Welcome, {displayName}
              </h1>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.8)",
                  background: "transparent",
                  color: "white",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await auth.signOut();
                    navigate("/", { replace: true });
                  } catch (err) {
                    console.error("Error signing out:", err);
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "none",
                  background:
                    "linear-gradient(90deg,rgba(248,113,113,1),rgba(239,68,68,1))",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          </div>

          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            Manage your profile, playlists and gigs from here.
          </p>
        </div>

        {/* Main dashboard actions */}
        <div
          style={{
            borderRadius: 24,
            padding: 14,
            background: "rgba(10,0,30,0.95)",
            border: "1px solid rgba(148,163,184,0.6)",
            boxShadow: "0 0 16px rgba(148,163,184,0.5)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <DashboardButton
              label="Master playlist"
              icon="🎧"
              onClick={() => navigate("/artist/master-playlist")}
              primary
            />
            <DashboardButton
              label="Gig playlists"
              icon="📻"
              onClick={() => navigate("/artist/gig-playlists")}
            />
            <DashboardButton
              label="My gigs"
              icon="📅"
              onClick={() => navigate("/artist/gigs")}
            />
            <DashboardButton
              label="Edit profile"
              icon="✏️"
              onClick={() => navigate("/artist/profile-setup")}
            />
          </div>
        </div>

        {/* Simple guidance card – can be replaced with stats later */}
        <div
          style={{
            borderRadius: 18,
            padding: 12,
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.6)",
            fontSize: 13,
          }}
        >
          <strong>Recommended flow</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            <li>Set up your <b>master playlist</b> (add songs via iTunes search or manually).</li>
            <li>Create <b>gig playlists</b> for specific shows, picking from your master list.</li>
            <li>Create gigs under <b>My gigs</b> and attach a gig playlist.</li>
            <li>If no gig playlist is selected, the crowd sees songs from your master playlist (respecting song limits).</li>
          </ul>
        </div>
      </div>

      <BottomNav />
    </>
  );
};

const DashboardButton = ({ label, icon, onClick, primary }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      borderRadius: 999,
      padding: "10px 12px",
      border: primary
        ? "1px solid rgba(56,189,248,1)"
        : "1px solid rgba(148,163,184,0.9)",
      background: primary
        ? "linear-gradient(90deg,rgba(56,189,248,0.9),rgba(129,140,248,0.9))"
        : "rgba(15,23,42,0.95)",
      color: "white",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

export default ArtistDashboard;
