// src/Pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { updateProfile, signOut } from "firebase/auth";
import BottomNav from "../components/BottomNav";

const ProfilePage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [interestedCount, setInterestedCount] = useState(0);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load user + interested stats
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        // Not logged in → go to signin and come back here
        navigate("/signin", { state: { redirectTo: "/profile" } });
        return;
      }

      try {
        setDisplayName(user.displayName || "");
        setPhotoUrl(user.photoURL || "");
        setEmail(user.email || "");

        const qInterests = query(
          collection(db, "gigInterests"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(qInterests);
        setInterestedCount(snap.size);
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/signin", { state: { redirectTo: "/profile" } });
        return;
      }

      await updateProfile(user, {
        displayName: displayName || null,
        photoURL: photoUrl || null,
      });

      setMessage("Profile updated.");
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/gigs");
    } catch (err) {
      console.error("Error signing out:", err);
      alert("Could not sign out. Please try again.");
    }
  };

  if (loading) {
    return (
      <>
        <div
          style={{
            minHeight: "100vh",
            background: "black",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui",
          }}
        >
          Loading profile…
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#06000D,#170022,#270036)",
          padding: 16,
          paddingBottom: 90,
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              textShadow: "0 0 10px rgba(255,0,200,0.8)",
            }}
          >
            My Profile
          </h2>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            Manage your GigWave identity and account.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            borderRadius: 20,
            padding: 18,
            background: "rgba(10,0,25,0.9)",
            border: "1px solid rgba(255,0,200,0.35)",
            boxShadow:
              "0 0 16px rgba(255,0,200,0.5), inset 0 0 10px rgba(255,0,200,0.18)",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(255,0,200,0.7)",
                background: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (displayName || email || "U")
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {displayName || "Unnamed User"}
            </p>
            <p
              style={{
                margin: 0,
                marginTop: 2,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              {email}
            </p>
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 16,
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {interestedCount}
              </div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>
                Interested gigs
              </div>
            </div>
          </div>

          {/* Message / error */}
          {message && (
            <div
              style={{
                marginBottom: 8,
                padding: 6,
                borderRadius: 8,
                fontSize: 12,
                background: "rgba(0,255,150,0.12)",
                border: "1px solid rgba(0,255,150,0.5)",
              }}
            >
              {message}
            </div>
          )}
          {error && (
            <div
              style={{
                marginBottom: 8,
                padding: 6,
                borderRadius: 8,
                fontSize: 12,
                background: "rgba(255,60,90,0.18)",
                border: "1px solid rgba(255,80,120,0.7)",
              }}
            >
              {error}
            </div>
          )}

          {/* Form: name + photo URL */}
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 4,
                  fontSize: 13,
                  opacity: 0.9,
                }}
              >
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(9,0,25,0.9)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                }}
                maxLength={40}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 4,
                  fontSize: 13,
                  opacity: 0.9,
                }}
              >
                Profile photo URL
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(9,0,25,0.9)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                }}
                placeholder="https://…"
              />
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  opacity: 0.6,
                }}
              >
                Paste an image URL for now. (We can add gallery upload later.)
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 8,
                padding: 12,
                borderRadius: 999,
                border: "none",
                fontWeight: 700,
                fontSize: 15,
                cursor: saving ? "default" : "pointer",
                background: saving
                  ? "rgba(150,150,150,0.7)"
                  : "linear-gradient(90deg,#ff00d4,#8800ff)",
                boxShadow: saving
                  ? "none"
                  : "0 0 16px rgba(255,0,200,0.9)",
                color: "white",
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>

          {/* View interested / logout */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/my-interested")}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View my interested gigs
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 999,
                border: "none",
                background: "rgba(255,70,70,0.85)",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
};

export default ProfilePage;
