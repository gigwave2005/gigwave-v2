// src/Pages/ArtistGigPlaylistsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export default function ArtistGigPlaylistsPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  // Gates
  const [profileOk, setProfileOk] = useState(false);

  // Playlist list
  const [playlists, setPlaylists] = useState([]);
  const [playlistSearch, setPlaylistSearch] = useState("");

  // Selected playlist
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Master tracks (for adding)
  const [masterTracks, setMasterTracks] = useState([]);
  const [masterSearch, setMasterSearch] = useState("");

  // Editing fields
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");

  // Errors / saving
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------
  // 🔐 ACCESS GATES
  // -------------------------------------------------------
  useEffect(() => {
    if (!currentUser) {
      navigate("/signin");
      return;
    }
    if (userProfile?.userType !== "artist") {
      navigate("/");
      return;
    }
    if (!currentUser.emailVerified) {
      navigate("/verify-email");
      return;
    }

    // Check profileCompleted
    const ref = doc(db, "artists", currentUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data?.profileCompleted) {
        setProfileOk(true);
      } else {
        navigate("/artist/profile-setup");
      }
    });

    return () => unsub();
  }, [currentUser, userProfile, navigate]);

  // -------------------------------------------------------
  // 🔁 LOAD PLAYLISTS
  // -------------------------------------------------------
  useEffect(() => {
    if (!profileOk) return;

    const colRef = collection(db, "artists", currentUser.uid, "gigPlaylists");
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      // Sort alphabetically
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setPlaylists(list);

      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    });

    return () => unsub();
  }, [profileOk, currentUser, selectedId]);

  // -------------------------------------------------------
  // 🔁 LOAD MASTER PLAYLIST
  // -------------------------------------------------------
  useEffect(() => {
    if (!profileOk) return;

    const colRef = collection(db, "artists", currentUser.uid, "masterPlaylist");
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // sort master tracks alphabetically by title (or artist if you prefer)
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

      setMasterTracks(list);
    });

    return () => unsub();
  }, [profileOk, currentUser]);

  // -------------------------------------------------------
  // WHEN SELECTED PLAYLIST CHANGES
  // -------------------------------------------------------
  useEffect(() => {
    if (!selectedId) {
      setSelectedPlaylist(null);
      setName("");
      setGenre("");
      setDescription("");
      return;
    }

    const playlist = playlists.find((p) => p.id === selectedId);
    if (!playlist) return;

    // MAKE A SAFE COPY so local edits won't mutate Firestore snapshot objects
    const safeCopy = {
      ...playlist,
      // ensure tracks array exists and is a shallow copy of track objects
      tracks: Array.isArray(playlist.tracks)
        ? playlist.tracks.map((t) => ({ ...t }))
        : [],
    };

    setSelectedPlaylist(safeCopy);

    setName(safeCopy.name || "");
    setGenre(safeCopy.genre || "");
    setDescription(safeCopy.description || "");
  }, [selectedId, playlists]);

  // -------------------------------------------------------
  // FILTER PLAYLISTS
  // -------------------------------------------------------
  const filteredPlaylists = useMemo(() => {
    if (!playlistSearch.trim()) return playlists;
    return playlists.filter((p) =>
      (p.name || "").toLowerCase().includes(playlistSearch.toLowerCase())
    );
  }, [playlistSearch, playlists]);

  // -------------------------------------------------------
  // FILTER MASTER TRACKS
  // -------------------------------------------------------
  const filteredMasterTracks = useMemo(() => {
    if (!masterSearch.trim()) return masterTracks;
    return masterTracks.filter((t) =>
      `${t.title} ${t.artistName}`
        .toLowerCase()
        .includes(masterSearch.toLowerCase())
    );
  }, [masterSearch, masterTracks]);

  // -------------------------------------------------------
  // CREATE NEW PLAYLIST
  // -------------------------------------------------------
  const handleCreateNew = async () => {
    const newName = prompt("Enter playlist name:");
    if (!newName || !newName.trim()) return;

    const colRef = collection(
      db,
      "artists",
      currentUser.uid,
      "gigPlaylists"
    );

    const newDoc = await addDoc(colRef, {
      name: newName.trim(),
      genre: "",
      description: "",
      tracks: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // set selectedId to new doc so effect picks it up
    setSelectedId(newDoc.id);
  };

  // -------------------------------------------------------
  // SAVE PLAYLIST
  // -------------------------------------------------------
  const handleSave = async () => {
    if (!selectedPlaylist) return;

    setSaving(true);
    setError("");

    try {
      const ref = doc(
        db,
        "artists",
        currentUser.uid,
        "gigPlaylists",
        selectedPlaylist.id
      );

      await updateDoc(ref, {
        name: name.trim(),
        genre: genre.trim(),
        description: description.trim(),
        // ALWAYS save from local edited copy
        tracks: selectedPlaylist.tracks || [],
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setError("Could not save playlist.");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------
  // DELETE PLAYLIST
  // -------------------------------------------------------
  const handleDelete = async () => {
    if (!selectedPlaylist) return;

    const yes = window.confirm("Delete this playlist?");
    if (!yes) return;

    await deleteDoc(
      doc(
        db,
        "artists",
        currentUser.uid,
        "gigPlaylists",
        selectedPlaylist.id
      )
    );

    setSelectedId(null);
    setSelectedPlaylist(null);
  };

  // -------------------------------------------------------
  // ADD TRACK TO PLAYLIST
  // -------------------------------------------------------
  const handleAddTrack = (track) => {
    if (!selectedPlaylist) return;

    const exists = (selectedPlaylist.tracks || []).some(
      (t) =>
        t.masterTrackId === track.id ||
        (t.itunesId && t.itunesId === track.itunesId)
    );
    if (exists) return;

    const newTrack = {
      masterTrackId: track.id,
      title: track.title,
      artistName: track.artistName || "",
      duration: track.duration || null,
      durationMs: track.durationMs || null,
      source: track.source || "manual",
      order: (selectedPlaylist.tracks?.length) || 0,
      itunesId: track.itunesId || null,
      artworkUrl: track.artworkUrl || null,
    };

    setSelectedPlaylist((prev) => ({
      ...prev,
      tracks: [...(prev?.tracks || []), newTrack],
    }));
  };

  // -------------------------------------------------------
  // REMOVE TRACK
  // -------------------------------------------------------
  const removeTrack = (index) => {
    setSelectedPlaylist((prev) => {
      const arr = [...(prev.tracks || [])];
      arr.splice(index, 1);
      return {
        ...prev,
        tracks: arr.map((t, i) => ({ ...t, order: i })),
      };
    });
  };

  // -------------------------------------------------------
  // REORDER
  // -------------------------------------------------------
  const moveTrack = (index, dir) => {
    setSelectedPlaylist((prev) => {
      const arr = [...(prev.tracks || [])];
      const newIndex = index + dir;
      if (newIndex < 0 || newIndex >= arr.length) return prev;

      const tmp = arr[index];
      arr[index] = arr[newIndex];
      arr[newIndex] = tmp;

      return {
        ...prev,
        tracks: arr.map((t, i) => ({ ...t, order: i })),
      };
    });
  };

  // -------------------------------------------------------
  // UI ELEMENTS
  // -------------------------------------------------------
  const neonInput = {
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.8)",
    background: "rgba(15,23,42,0.9)",
    color: "white",
    fontSize: 13,
    outline: "none",
    marginBottom: 8,
  };

  const neonCard = {
    background: "rgba(10,0,30,0.95)",
    border: "1px solid rgba(129,140,248,0.5)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  };

  if (!profileOk) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "black",
          color: "white",
          padding: 16,
        }}
      >
        Checking artist…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#06000D,#170022,#270036)",
        color: "white",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      {/* HEADER */}
      <div style={{ maxWidth: 1200, margin: "0 auto 16px" }}>
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
          Gig Playlists
        </h2>
        <p style={{ opacity: 0.8, fontSize: 13 }}>
          Create and edit playlists for your gigs. These are independent from
          your Master Playlist.
        </p>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.85fr 1.15fr",
          gap: 16,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* LEFT COLUMN: playlist list */}
        <div>
          {/* CREATE + SEARCH */}
          <div
            style={{
              ...neonCard,
              border: "1px solid rgba(129,140,248,0.8)",
            }}
          >
            <button
              onClick={handleCreateNew}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(90deg,#ff00d4,#8800ff)",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
                width: "100%",
                marginBottom: 8,
              }}
            >
              + Create New Playlist
            </button>

            <input
              placeholder="Search playlist"
              value={playlistSearch}
              onChange={(e) => setPlaylistSearch(e.target.value)}
              style={neonInput}
            />
          </div>

          {/* PLAYLIST LIST */}
          <div
            style={{
              ...neonCard,
              maxHeight: "70vh",
              overflowY: "auto",
            }}
          >
            {filteredPlaylists.length === 0 ? (
              <p style={{ opacity: 0.6, fontSize: 13 }}>
                No playlists found.
              </p>
            ) : (
              filteredPlaylists.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 6,
                    cursor: "pointer",
                    background:
                      selectedId === p.id
                        ? "rgba(88,28,135,0.8)"
                        : "rgba(15,23,42,0.8)",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    ♪ {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                      marginTop: 2,
                    }}
                  >
                    {p.genre || "No genre"} · {p.tracks?.length || 0} songs
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: playlist editor */}
        <div>
          {!selectedPlaylist ? (
            <div
              style={{
                ...neonCard,
                textAlign: "center",
                fontSize: 14,
                opacity: 0.8,
              }}
            >
              Select a playlist to edit.
            </div>
          ) : (
            <div style={neonCard}>
              {/* PLAYLIST DETAILS */}
              <h3 style={{ marginTop: 0 }}>Edit Playlist</h3>

              <input
                placeholder="Playlist name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={neonInput}
              />

              <input
                placeholder="Genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                style={neonInput}
              />

              <textarea
                placeholder="Description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...neonInput, resize: "vertical" }}
              />

              {/* MASTER PLAYLIST ADDING */}
              <h4 style={{ marginTop: 16 }}>Add from Master Playlist</h4>

              <input
                placeholder="Search master tracks"
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                style={neonInput}
              />

              <div
                style={{
                  maxHeight: 220,
                  overflowY: "auto",
                  marginBottom: 16,
                }}
              >
                {filteredMasterTracks.map((t) => {
                  const already = (selectedPlaylist.tracks || []).some(
                    (track) =>
                      track.masterTrackId === t.id ||
                      (track.itunesId &&
                        t.itunesId &&
                        track.itunesId === t.itunesId)
                  );

                  return (
                    <div
                      key={t.id}
                      style={{
                        marginBottom: 6,
                        padding: 8,
                        borderRadius: 6,
                        background: "rgba(15,23,42,0.85)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {t.artistName}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddTrack(t)}
                        disabled={already}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "none",
                          cursor: already ? "not-allowed" : "pointer",
                          background: already
                            ? "rgba(100,100,100,0.5)"
                            : "linear-gradient(90deg,#22c55e,#16a34a)",
                          fontSize: 12,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {already ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* TRACK LIST */}
              <h4 style={{ marginTop: 16 }}>Tracks in Playlist</h4>

              {selectedPlaylist.tracks?.length === 0 ? (
                <p style={{ opacity: 0.6, fontSize: 13 }}>
                  No tracks in this playlist yet.
                </p>
              ) : (
                <div
                  style={{
                    maxHeight: 260,
                    overflowY: "auto",
                    marginBottom: 16,
                  }}
                >
                  {selectedPlaylist.tracks.map((track, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: 6,
                        padding: 8,
                        borderRadius: 6,
                        background: "rgba(15,23,42,0.95)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {track.title}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {track.artistName}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => moveTrack(i, -1)}
                          disabled={i === 0}
                          style={{
                            padding: "4px 6px",
                            borderRadius: 6,
                            fontSize: 11,
                            border: "1px solid #ccc",
                            cursor:
                              i === 0 ? "not-allowed" : "pointer",
                            background: "rgba(30,41,59,0.7)",
                          }}
                        >
                          ↑
                        </button>

                        <button
                          onClick={() => moveTrack(i, 1)}
                          disabled={i === selectedPlaylist.tracks.length - 1}
                          style={{
                            padding: "4px 6px",
                            borderRadius: 6,
                            fontSize: 11,
                            border: "1px solid #ccc",
                            cursor:
                              i === selectedPlaylist.tracks.length - 1
                                ? "not-allowed"
                                : "pointer",
                            background: "rgba(30,41,59,0.7)",
                          }}
                        >
                          ↓
                        </button>

                        <button
                          onClick={() => removeTrack(i)}
                          style={{
                            padding: "4px 6px",
                            borderRadius: 6,
                            fontSize: 11,
                            border: "1px solid rgba(248,113,113,0.9)",
                            color: "white",
                            background: "rgba(127,29,29,0.9)",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ERROR */}
              {error && (
                <p style={{ color: "#fecaca", fontSize: 12 }}>{error}</p>
              )}

              {/* SAVE / DELETE BUTTONS */}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    background: saving
                      ? "rgba(150,150,150,0.6)"
                      : "linear-gradient(90deg,#ff00d4,#8800ff)",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {saving ? "Saving…" : "Save Playlist"}
                </button>

                <button
                  onClick={handleDelete}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid rgba(248,113,113,0.9)",
                    background: "rgba(127,29,29,0.9)",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
