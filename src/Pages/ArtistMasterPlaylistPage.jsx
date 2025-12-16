// src/Pages/ArtistMasterPlaylistPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

function ArtistMasterPlaylistPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [profileOk, setProfileOk] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [error, setError] = useState("");

  // Add manual track form
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtistName, setManualArtistName] = useState("");
  const [manualDuration, setManualDuration] = useState(""); // "3:45" or seconds

  // iTunes search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // 🔐 GATE: must be artist + profile complete
  useEffect(() => {
    if (!currentUser) {
      navigate("/signin");
      return;
    }

    if (userProfile?.userType !== "artist") {
      navigate("/");
      return;
    }

    // Block if email not verified
    if (!currentUser.emailVerified) {
      navigate("/verify-email");
      return;
    }

    const ref = doc(db, "artists", currentUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (!snap.exists() || !data?.profileCompleted) {
        navigate("/artist/profile-setup");
      } else {
        setProfileOk(true);
      }
    });

    return () => unsub();
  }, [currentUser, userProfile, navigate]);

  // 🔁 Load master playlist tracks
  useEffect(() => {
    if (!profileOk || !currentUser) return;

    const colRef = collection(db, "artists", currentUser.uid, "masterPlaylist");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // 🆕 Sort alphabetically by artistName (A–Z)
        list.sort((a, b) => {
          const aName = (a.artistName || "").toLowerCase();
          const bName = (b.artistName || "").toLowerCase();
          if (aName < bName) return -1;
          if (aName > bName) return 1;
          // if artist names equal or missing, fallback to title
          const aTitle = (a.title || "").toLowerCase();
          const bTitle = (b.title || "").toLowerCase();
          if (aTitle < bTitle) return -1;
          if (aTitle > bTitle) return 1;
          return 0;
        });

        setTracks(list);
        setLoadingTracks(false);
      },
      (err) => {
        console.error("Error loading master playlist", err);
        setError("Error loading master playlist.");
        setLoadingTracks(false);
      }
    );

    return () => unsub();
  }, [profileOk, currentUser]);

  const handleAddManualTrack = async (e) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualArtistName.trim()) {
      setError("Please enter song title and artist name.");
      return;
    }
    setError("");

    try {
      const colRef = collection(
        db,
        "artists",
        currentUser.uid,
        "masterPlaylist"
      );
      await addDoc(colRef, {
        title: manualTitle.trim(),
        artistName: manualArtistName.trim(),
        duration: manualDuration.trim() || null,
        source: "manual",
        createdAt: serverTimestamp(),
      });

      setManualTitle("");
      setManualArtistName("");
      setManualDuration("");
    } catch (err) {
      console.error("Error adding manual track", err);
      setError("Could not add track. Please try again.");
    }
  };

  const handleDeleteTrack = async (trackId) => {
    if (!window.confirm("Delete this track from your master playlist?")) return;

    try {
      const trackRef = doc(
        db,
        "artists",
        currentUser.uid,
        "masterPlaylist",
        trackId
      );
      await deleteDoc(trackRef);
    } catch (err) {
      console.error("Error deleting track", err);
      setError("Could not delete track.");
    }
  };

  // 🔍 iTunes search (simple client-side fetch)
  const handleSearchItunes = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearchError("");
    setSearchLoading(true);
    setSearchResults([]);

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm
      )}&entity=song&limit=10`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Search failed");
      }
      const data = await res.json();
      const results = (data.results || []).map((item) => ({
        itunesId: item.trackId,
        title: item.trackName,
        artistName: item.artistName,
        durationMs: item.trackTimeMillis,
        artworkUrl: item.artworkUrl60,
      }));
      setSearchResults(results);
    } catch (err) {
      console.error("Error searching iTunes", err);
      setSearchError("Could not search iTunes. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddItunesTrack = async (track) => {
    // 🛑 Prevent adding the same iTunes song twice
    const alreadyExists = tracks.some(
      (t) => t.source === "itunes" && t.itunesId === track.itunesId
    );
    if (alreadyExists) {
      return; // silently ignore duplicate
    }

    try {
      const colRef = collection(
        db,
        "artists",
        currentUser.uid,
        "masterPlaylist"
      );
      await addDoc(colRef, {
        title: track.title,
        artistName: track.artistName,
        durationMs: track.durationMs || null,
        source: "itunes",
        itunesId: track.itunesId,
        artworkUrl: track.artworkUrl || null,
        createdAt: serverTimestamp(),
      });
      // no alert; track just appears in sorted list
    } catch (err) {
      console.error("Error adding iTunes track", err);
      setError("Could not add iTunes track.");
    }
  };

  if (!profileOk) {
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
        <p>Checking artist profile…</p>
      </div>
    );
  }

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
      {/* Header */}
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto 16px",
        }}
      >
        <button
          onClick={() => navigate("/artist/dashboard")}
          style={{
            marginBottom: 12,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.8)",
            background: "rgba(0,0,0,0.4)",
            color: "white",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ← Back to dashboard
        </button>

        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          Master playlist
        </h2>
        <p
          style={{
            fontSize: 13,
            opacity: 0.8,
            marginTop: 4,
            maxWidth: 520,
          }}
        >
          Add songs manually or from iTunes. This playlist is the base for your
          gig playlists and is used when a gig doesn&apos;t have its own list.
        </p>

        {error && (
          <p style={{ color: "#fecaca", fontSize: 13, marginTop: 8 }}>
            {error}
          </p>
        )}
      </div>

      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)",
          gap: 16,
        }}
      >
        {/* Left column: manual add + iTunes search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Add manually */}
          <section
            style={{
              borderRadius: 18,
              padding: 12,
              background: "rgba(10,0,30,0.95)",
              border: "1px solid rgba(129,140,248,0.7)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Add song manually
            </h3>
            <form
              onSubmit={handleAddManualTrack}
              style={{ display: "grid", gap: 8 }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
                  Song title
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
                  Artist name
                </label>
                <input
                  type="text"
                  value={manualArtistName}
                  onChange={(e) => setManualArtistName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: 12,
                    opacity: 0.9,
                  }}
                >
                  Duration (optional, e.g. 3:45)
                </label>
                <input
                  type="text"
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button type="submit" style={primaryButtonStyle}>
                Add song
              </button>
            </form>
          </section>

          {/* iTunes search */}
          <section
            style={{
              borderRadius: 18,
              padding: 12,
              background: "rgba(10,0,30,0.95)",
              border: "1px solid rgba(34,197,94,0.7)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Search iTunes
            </h3>
            <form
              onSubmit={handleSearchItunes}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                type="text"
                placeholder="Search songs or artists"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="submit" style={secondaryButtonStyle}>
                {searchLoading ? "Searching…" : "Search"}
              </button>
            </form>

            {searchError && (
              <p
                style={{
                  color: "#fecaca",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {searchError}
              </p>
            )}

            {searchResults.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {searchResults.map((t) => (
                  <li
                    key={t.itunesId}
                    style={{
                      borderRadius: 10,
                      padding: 8,
                      marginBottom: 6,
                      background: "rgba(15,23,42,0.95)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {t.artworkUrl && (
                        <img
                          src={t.artworkUrl}
                          alt={t.title}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 4,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {t.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.8,
                          }}
                        >
                          {t.artistName}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddItunesTrack(t)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "none",
                        background:
                          "linear-gradient(90deg,#22c55e,#16a34a)",
                        color: "black",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column: existing master playlist */}
        <section
          style={{
            borderRadius: 18,
            padding: 12,
            background: "rgba(10,0,30,0.95)",
            border: "1px solid rgba(148,163,184,0.7)",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Your master playlist
          </h3>

          {loadingTracks ? (
            <p style={{ fontSize: 13 }}>Loading tracks…</p>
          ) : tracks.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              No songs yet. Start by adding some on the left.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {tracks.map((track) => (
                <li
                  key={track.id}
                  style={{
                    borderRadius: 10,
                    padding: 8,
                    marginBottom: 6,
                    background: "rgba(15,23,42,0.98)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {track.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.8,
                      }}
                    >
                      {track.artistName || "Unknown artist"}
                    </div>
                    {track.duration && (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                        }}
                      >
                        {track.duration}
                      </div>
                    )}
                    {track.source && (
                      <div
                        style={{
                          fontSize: 10,
                          opacity: 0.7,
                          marginTop: 2,
                        }}
                      >
                        Source: {track.source}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTrack(track.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(248,113,113,0.9)",
                      background: "rgba(127,29,29,0.9)",
                      color: "white",
                      fontSize: 11,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(148,163,184,0.8)",
  background: "rgba(15,23,42,0.9)",
  color: "white",
  fontSize: 13,
  outline: "none",
};

const primaryButtonStyle = {
  marginTop: 4,
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  background: "linear-gradient(90deg,#ff00d4,#8800ff)",
  color: "white",
};

const secondaryButtonStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  background: "linear-gradient(90deg,#22c55e,#16a34a)",
  color: "black",
};

export default ArtistMasterPlaylistPage;
