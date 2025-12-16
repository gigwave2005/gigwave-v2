import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection, 
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

export default function ArtistGigPlaylistEditor() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [playlistName, setPlaylistName] = useState("");
  const [tracks, setTracks] = useState([]);
  
  // ⭐ Master playlist (source for gig playlist)
  const [masterTracks, setMasterTracks] = useState([]);
  // ⭐ Search master playlist
  const [searchQuery, setSearchQuery] = useState("");

  // =========================
  // Load playlist
  // =========================
  useEffect(() => {
    if (!currentUser || !playlistId) return;

    const load = async () => {
      try {
        const ref = doc(
          db,
          "artists",
          currentUser.uid,
          "gigPlaylists",
          playlistId
        );
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("Playlist not found");
          navigate(-1);
          return;
        }

        const data = snap.data();
        setPlaylistName(data.name || "");
        setTracks(Array.isArray(data.tracks) ? data.tracks : []);
      } catch (err) {
        console.error("Error loading playlist:", err);
        alert("Failed to load playlist");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser, playlistId, navigate]);

  // =========================
// Load master playlist (READ-ONLY source)
// =========================
useEffect(() => {
  if (!currentUser?.uid) {
    setMasterTracks([]);
    return;
  }

  const ref = collection(
    db,
    "artists",
    currentUser.uid,
    "masterPlaylist"
  );

  const unsub = onSnapshot(ref, (snap) => {
    setMasterTracks(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  });

  return () => unsub();
}, [currentUser]);

// =========================
// Filter + sort master playlist (Artist → Song)
// =========================
const filteredMasterTracks = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();

  return masterTracks
    .filter((t) => {
      const artist = (t.artistName || "").toLowerCase();
      const title = (t.title || t.name || "").toLowerCase();
      return artist.includes(q) || title.includes(q);
    })
    .sort((a, b) => {
      const artistA = (a.artistName || "").toLowerCase();
      const artistB = (b.artistName || "").toLowerCase();

      if (artistA !== artistB) {
        return artistA.localeCompare(artistB);
      }

      const titleA = (a.title || a.name || "").toLowerCase();
      const titleB = (b.title || b.name || "").toLowerCase();

      return titleA.localeCompare(titleB);
    });
}, [masterTracks, searchQuery]);

  // =========================
  // Save
  // =========================
  const handleSave = async () => {
    if (!currentUser || !playlistId) return;
    if (!playlistName.trim()) {
      alert("Playlist name is required");
      return;
    }

    try {
      setSaving(true);
      const ref = doc(
        db,
        "artists",
        currentUser.uid,
        "gigPlaylists",
        playlistId
      );

      await updateDoc(ref, {
        name: playlistName.trim(),
        tracks,
        updatedAt: serverTimestamp(),
      });

      alert("Playlist saved");
      navigate(-1);
    } catch (err) {
      console.error("Error saving playlist:", err);
      alert("Failed to save playlist");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Remove track
  // =========================
  const removeTrack = (idx) => {
    setTracks((prev) => prev.filter((_, i) => i !== idx));
  };

// =========================
// Add track from master playlist
// =========================
const addFromMaster = (track) => {
  setTracks((prev) => {
    const exists = prev.some(
      (t) =>
        t.id === track.id ||
        (t.title === track.title &&
          t.artistName === track.artistName)
    );

    if (exists) return prev;

    return [
      ...prev,
      {
        id: track.id,              // Firestore doc id
        title: track.title || track.name,
        artistName: track.artistName || null,
        source: "master",
      },
    ];
  });
};

  // =========================
  // Render
  // =========================
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        Loading playlist…
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>Edit Gig Playlist</h2>

      <label style={{ display: "block", marginBottom: 8 }}>
        Playlist name
      </label>
      <input
        value={playlistName}
        onChange={(e) => setPlaylistName(e.target.value)}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 16,
        }}
      />

      <h3>Tracks ({tracks.length})</h3>

      <h3 style={{ marginTop: 24 }}>Add from Master Playlist</h3>

        <input
        type="text"
        placeholder="Search by artist or song…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
            width: "100%",
            padding: 8,
            marginBottom: 12,
        }}
        />

        <div
        style={{
            maxHeight: 260,
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 8,
        }}
        >
        {filteredMasterTracks.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.7 }}>
            No matching tracks in master playlist.
            </p>
        ) : (
            filteredMasterTracks.map((t) => (
            <div
                key={t.id}
                style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid #eee",
                }}
            >
                <span style={{ fontSize: 13 }}>
                <strong>{t.artistName || "Unknown artist"}</strong>
                {" — "}
                {t.title || t.name || "Untitled track"}
                </span>

                <button
                type="button"
                onClick={() => addFromMaster(t)}
                style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                }}
                >
                Add
                </button>
            </div>
            ))
        )}
        </div>

      {tracks.length === 0 ? (
        <p>No tracks in this playlist.</p>
      ) : (
        <ul style={{ paddingLeft: 16 }}>
          {tracks.map((t, idx) => {
            const label =
              t.title ||
              t.name ||
              "Untitled track";

            return (
              <li
                key={t.id || `${t.title}_${t.artistName}_${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span>
                  {label}
                  {t.artistName ? ` — ${t.artistName}` : ""}
                </span>
                <button onClick={() => removeTrack(idx)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 20,
          padding: "10px 16px",
          fontWeight: 700,
        }}
      >
        {saving ? "Saving…" : "Save playlist"}
      </button>
    </div>
  );
}
