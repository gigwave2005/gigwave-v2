// src/Pages/ArtistGigsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  deleteField,
} from "firebase/firestore";

// Adjust this import path if your component is elsewhere
import VenueLocationPicker from "../components/VenueLocationPicker";

function ArtistGigsPage() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [profileOk, setProfileOk] = useState(false);
  const [error, setError] = useState("");

  const [gigs, setGigs] = useState([]);
  const [loadingGigs, setLoadingGigs] = useState(true);

  // Form state
  const [editingGigId, setEditingGigId] = useState(null); // null = create new
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueLocation, setVenueLocation] = useState(null);
  const [songLimit, setSongLimit] = useState(10);
  const [durationHours, setDurationHours] = useState(5);

  const [saving, setSaving] = useState(false);

  // NEW: gig playlists for dropdown + selected playlist id
  const [gigPlaylists, setGigPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");

  // ───────────────────────────────────────────────────────────────
  // 🔐 Gate: only logged-in artists with completed profile
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      navigate("/signin");
      return;
    }

    if (userProfile?.userType !== "artist") {
      navigate("/");
      return;
    }

    // NEW: block dashboard if email not verified
    if (!currentUser.emailVerified) {
      navigate("/verify-email");
      return;
    }

    const ref = doc(db, "artists", currentUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (!snap.exists() || !data?.profileCompleted) {
          navigate("/artist/profile-setup");
        } else {
          setProfileOk(true);
        }
      },
      (err) => {
        console.error("Error checking artist doc", err);
      }
    );

    return () => unsub();
  }, [currentUser, userProfile, navigate]);

  // ───────────────────────────────────────────────────────────────
  // Load artist's gigPlaylists for dropdown (live)
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileOk || !currentUser) {
      setGigPlaylists([]);
      setLoadingPlaylists(false);
      return;
    }

    setLoadingPlaylists(true);
    const col = collection(db, "artists", currentUser.uid, "gigPlaylists");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setGigPlaylists(list);
        setLoadingPlaylists(false);
      },
      (err) => {
        console.error("Error loading gig playlists", err);
        setGigPlaylists([]);
        setLoadingPlaylists(false);
      }
    );

    return () => unsub();
  }, [profileOk, currentUser]);

  // ───────────────────────────────────────────────────────────────
  // Load gigs for this artist (real-time)
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileOk || !currentUser) return;

    setLoadingGigs(true);
    const gigsCol = collection(db, "gigs");
    const q = query(gigsCol, where("artistId", "==", currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGigs(list);
        setLoadingGigs(false);
      },
      (err) => {
        console.error("Error loading gigs", err);
        setError("Error loading gigs.");
        setLoadingGigs(false);
      }
    );

    return () => unsub();
  }, [profileOk, currentUser]);

  // ───────────────────────────────────────────────────────────────
  // Form helpers
  // ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingGigId(null);
    setTitle("");
    setDate("");
    setTime("");
    setVenueName("");
    setVenueLocation(null);
    setSongLimit(10);
    setDurationHours(5);
    setSelectedPlaylistId("");
  };

  const fillFormFromGig = (gig) => {
  setEditingGigId(gig.id);
  setTitle(gig.title || "");
  setDate(gig.date || "");
  setTime(gig.time || "");
  setVenueName(gig.venueName || "");
  setVenueLocation(gig.venueLocation || null);
  setSongLimit(gig.songLimit || 10);
  setDurationHours(gig.durationHours || 5);

    // pre-select attached playlist if present (explicit null/undefined => fallback)
    setSelectedPlaylistId(gig.gigPlaylistId ?? "");
  };

  const validateSongLimit = (value) => {
    let n = Number(value);
    if (Number.isNaN(n)) n = 5;
    if (n < 5) n = 5;
    if (n > 60) n = 60;
    return n;
  };

  // ───────────────────────────────────────────────────────────────
  // Create or update gig (handles gigPlaylistId correctly)
  // ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !date || !time || !venueName.trim()) {
      setError("Please fill in title, date, time and venue name.");
      return;
    }

    const finalSongLimit = validateSongLimit(songLimit);
    const finalDuration = durationHours > 0 ? Number(durationHours) : 5;

    setSaving(true);
    try {
      if (!editingGigId) {
        // CREATE NEW GIG
        const gigsRef = collection(db, "gigs");

        const baseGig = {
          artistId: currentUser.uid,
          title: title.trim(),
          date,
          time,
          venueName: venueName.trim(),
          venueLocation: venueLocation || null,
          status: "upcoming",
          songLimit: finalSongLimit,
          durationHours: finalDuration,
          allowCustomRequests: false,
          jukeboxEnabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (selectedPlaylistId) {
          // Option A: store gigPlaylistId only (do NOT auto-populate from master)
          await addDoc(gigsRef, {
            ...baseGig,
            gigPlaylistId: selectedPlaylistId,
          });
        } else {
          // No attached playlist -> auto-populate gigPlaylist from master (legacy behavior)
          let gigPlaylist = [];
          const masterRef = collection(
            db,
            "artists",
            currentUser.uid,
            "masterPlaylist"
          );
          const masterSnap = await getDocs(masterRef);
          const masterTracks = masterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

          if (masterTracks.length > 0) {
            const shuffled = [...masterTracks].sort(() => Math.random() - 0.5);
            const limit = Math.min(finalSongLimit, shuffled.length);
            gigPlaylist = shuffled.slice(0, limit).map((track, index) => ({
              masterTrackId: track.id,
              title: track.title,
              artistName: track.artistName || "",
              duration: track.duration || null,
              durationMs: track.durationMs || null,
              source: track.source || "manual",
              itunesId: track.itunesId || null,
              artworkUrl: track.artworkUrl || null,
              order: index,
              isPlayed: false,
            }));
          }

          await addDoc(gigsRef, {
            ...baseGig,
            gigPlaylist,
          });
        }

        resetForm();
      } else {
        // EDIT EXISTING GIG
        const gigRef = doc(db, "gigs", editingGigId);
        const gig = gigs.find((g) => g.id === editingGigId);

        // CASE 1: user selected a SAVED playlist
        if (selectedPlaylistId) {
          await updateDoc(gigRef, {
            title: title.trim(),
            date,
            time,
            venueName: venueName.trim(),
            venueLocation: venueLocation || null,
            songLimit: finalSongLimit,
            durationHours: finalDuration,

            // single source of truth
            gigPlaylistId: selectedPlaylistId,
            gigPlaylist: deleteField(),

            updatedAt: serverTimestamp(),
          });
        }
        // CASE 2: no playlist selected → embedded playlist flow
        else {
          let updatedGigPlaylist = Array.isArray(gig?.gigPlaylist)
            ? [...gig.gigPlaylist]
            : [];

          // enforce song limit
          if (updatedGigPlaylist.length > finalSongLimit) {
            updatedGigPlaylist = updatedGigPlaylist
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .slice(0, finalSongLimit)
              .map((t, index) => ({ ...t, order: index }));
          }

          await updateDoc(gigRef, {
            title: title.trim(),
            date,
            time,
            venueName: venueName.trim(),
            venueLocation: venueLocation || null,
            songLimit: finalSongLimit,
            durationHours: finalDuration,

            gigPlaylist: updatedGigPlaylist,
            gigPlaylistId: deleteField(),

            updatedAt: serverTimestamp(),
          });
        }

        resetForm();
      }
    } catch (err) {
      console.error("Error saving gig", err);
      setError("Could not save gig. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────────
  // Actions: edit, cancel, delete
  // ───────────────────────────────────────────────────────────────
  const handleEditClick = (gig) => {
    fillFormFromGig(gig);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelGig = async (gigId) => {
    if (!window.confirm("Mark this gig as cancelled?")) return;
    try {
      const gigRef = doc(db, "gigs", gigId);
      await updateDoc(gigRef, { status: "cancelled", updatedAt: serverTimestamp() });
    } catch (err) {
      console.error("Error cancelling gig", err);
      setError("Could not cancel gig.");
    }
  };

  const handleDeleteGig = async (gigId) => {
    if (
      !window.confirm(
        "Delete this gig permanently? This will remove it from the system."
      )
    )
      return;
    try {
      const gigRef = doc(db, "gigs", gigId);
      await deleteDoc(gigRef);
    } catch (err) {
      console.error("Error deleting gig", err);
      setError("Could not delete gig.");
    }
  };

  if (!profileOk) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <p>Checking artist profile…</p>
      </div>
    );
  }

  // derive preview for selected playlist (first 3 tracks)
  const selectedPlaylistObj =
  selectedPlaylistId && gigPlaylists.length > 0
    ? gigPlaylists.find((p) => p.id === selectedPlaylistId) || null
    : null;

const selectedPlaylistMissing =
  selectedPlaylistId && !selectedPlaylistObj;
  const previewCount = 3;

  const selectedPlaylistPreviewTracks = selectedPlaylistObj?.tracks
    ? selectedPlaylistObj.tracks.slice(0, previewCount)
    : [];

  // Badge text: Using [playlist] or Using Master
  const badgeText = selectedPlaylistObj
    ? `Using: ${selectedPlaylistObj.name || "Attached gig playlist"}`
    : "Using: Master Playlist (fallback)";

  // Whether attached playlist will be supplemented (if its length < songLimit)
  const willBeSupplemented =
    selectedPlaylistObj && Array.isArray(selectedPlaylistObj.tracks)
      ? selectedPlaylistObj.tracks.length < (songLimit || 0)
      : false;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 900 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: 12, padding: "4px 8px" }}
      >
        ⬅ Back
      </button>

      <h2 style={{ marginBottom: 8 }}>Gigs – Create / Edit / Delete</h2>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
        Set up your gigs with song limits and durations. You can attach a saved Gig Playlist or let the system auto-populate from your Master Playlist.
      </p>

      {error && (
        <p style={{ color: "red", fontSize: 13, marginBottom: 8 }}>{error}</p>
      )}

      {/* CREATE / EDIT FORM */}
      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
          {editingGigId ? "Edit gig" : "Create new gig"}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 4 }}>
              Gig title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 10,
            }}
          >
            {/* Date */}
            <div>
              <label style={{ display: "block", marginBottom: 4 }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>

            {/* Time */}
            <div>
              <label style={{ display: "block", marginBottom: 4 }}>Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
          </div>

          {/* Venue Name */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 4 }}>
              Venue Name
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. Hard Rock Cafe"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          {/* Venue Location (Google Places autocomplete) */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 4 }}>
              Venue Location
            </label>
            <VenueLocationPicker
              value={venueLocation}
              onChange={setVenueLocation}
            />
          </div>

          {/* Attach existing Gig Playlist */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Attach saved Gig Playlist (optional)
            </label>
            {loadingPlaylists ? (
              <div style={{ fontSize: 13, color: "#666" }}>Loading playlists…</div>
            ) : gigPlaylists.length === 0 ? (
              <div style={{ fontSize: 13, color: "#666" }}>
                No gig playlists found. Create them from the Artist Dashboard → Gig Playlists.
              </div>
            ) : (
              <select
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              >
                <option value="">— Use Master Playlist / Auto-populate —</option>
                {gigPlaylists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.tracks?.length || 0} songs)
                  </option>
                ))}
              </select>
            )}
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              {selectedPlaylistId
                ? "Attached playlist will be used as the gig's source. If it has fewer tracks than your song limit, Master Playlist supplements will be used."
                : "No attached playlist — Master Playlist will be used or an embedded playlist will be auto-populated on creation."}
            </div>

            {/* Playlist preview box */}
            {selectedPlaylistObj && (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  background: "#f7f7f9",
                  border: "1px solid #eee",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>{selectedPlaylistObj.name || "Playlist preview"}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link
                      to={`/artist/gig-playlists/${selectedPlaylistObj.id}`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        textDecoration: "none",
                        color: "#111",
                        background: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      View full playlist
                    </Link>
                    <Link
                      to={`/artist/gig-playlists`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        textDecoration: "none",
                        color: "#111",
                        background: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Manage playlists
                    </Link>
                  </div>
                </div>

                {selectedPlaylistPreviewTracks.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedPlaylistPreviewTracks.map((t, i) => {
                      const title = t.title || t.name || `Track ${i + 1}`;
                      const artist = t.artist || t.artistName || "";
                      const artwork = t.artworkUrl || t.artwork || t.image || null;

                      return (
                        <li key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: 8, borderRadius: 8, background: "#fff", color: "#111" }}>
                          <div style={{ width: 46, height: 46, borderRadius: 6, overflow: "hidden", background: "#eee", flexShrink: 0 }}>
                            {artwork ? (
                              // eslint-disable-next-line jsx-a11y/alt-text
                              <img src={artwork} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#666" }}>
                                No image
                              </div>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                            {artist ? <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{artist}</div> : null}
                          </div>

                          <div style={{ fontSize: 12, color: "#666", fontWeight: 700 }}>
                            {i === 0 && willBeSupplemented ? <span style={{ color: "#b45309" }}>Will be supplemented</span> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div style={{ fontSize: 13, color: "#666" }}>No tracks in this playlist.</div>
                )}

                {/* If playlist is shorter than songLimit show a small note */}
                {willBeSupplemented && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#b45309" }}>
                    Note: this attached Gig Playlist has fewer tracks than the configured song limit — Master Playlist will supplement when the gig runs.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Song limit + duration */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: 4 }}>
                Number of songs (5–60)
              </label>
              <input
                type="number"
                value={songLimit}
                min={5}
                max={60}
                onChange={(e) => setSongLimit(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4 }}>
                Gig duration (hours)
              </label>
              <input
                type="number"
                value={durationHours}
                min={1}
                max={12}
                onChange={(e) => setDurationHours(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {saving
                ? editingGigId
                  ? "Updating..."
                  : "Creating..."
                : editingGigId
                ? "Update Gig"
                : "Create Gig"}
            </button>

            {editingGigId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* GIG LIST */}
      <section>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Your gigs</h3>

        {loadingGigs ? (
          <p>Loading gigs…</p>
        ) : gigs.length === 0 ? (
          <p style={{ fontSize: 14, color: "#555" }}>
            You haven&apos;t created any gigs yet.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {gigs
              .slice()
              .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
              .map((gig) => (
                <li
                  key={gig.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{gig.title}</div>
                    <div style={{ fontSize: 13, color: "#333" }}>
                      {gig.venueName || "Unnamed venue"}
                    </div>
                    {gig.venueLocation?.address && (
                      <div style={{ fontSize: 12, color: "#777" }}>
                        {gig.venueLocation.address}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                      {gig.date} · {gig.time}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#888",
                        marginTop: 2,
                      }}
                    >
                      Status: {gig.status || "unknown"} · Songs limit:{" "}
                      {gig.songLimit || "?"}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      onClick={() => handleEditClick(gig)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleCancelGig(gig.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #f97316",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#f97316",
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={() => handleDeleteGig(gig.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #ef4444",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#ef4444",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ArtistGigsPage;
