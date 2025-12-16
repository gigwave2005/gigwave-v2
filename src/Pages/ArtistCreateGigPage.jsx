// src/Pages/ArtistCreateGigPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  onSnapshot,
} from "firebase/firestore";
import VenueLocationPicker from "../components/VenueLocationPicker";
import { useAuth } from "../context/AuthContext";

function ArtistCreateGigPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  // Access / gating
  const [profileOk, setProfileOk] = useState(false);

  // Gig fields (existing + new)
  const [title, setTitle] = useState("");
  const [venueName, setVenueName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venueLocation, setVenueLocation] = useState(null);

  const [description, setDescription] = useState("");
  const [songLimit, setSongLimit] = useState(""); // string -> number

  // Gig playlists for dropdown
  const [gigPlaylists, setGigPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Constants for song limit validation (project standard)
  const MIN_SONG_LIMIT = 5;
  const MAX_SONG_LIMIT = 60;

  // ------------------------------------------------
  // 🔐 Gate: must be artist, verified, profileCompleted
  // ------------------------------------------------
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

  // ------------------------------------------------
  // 🔁 Load artist gig playlists (for dropdown)
  // ------------------------------------------------
  useEffect(() => {
    if (!profileOk || !currentUser) return;

    const colRef = collection(db, "artists", currentUser.uid, "gigPlaylists");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setGigPlaylists(list);
        setLoadingPlaylists(false);
      },
      (err) => {
        console.error("Error loading gig playlists", err);
        setLoadingPlaylists(false);
      }
    );

    return () => unsub();
  }, [profileOk, currentUser]);

  // ------------------------------------------------
  // Submit handler
  // ------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a gig title.");
      return;
    }
    if (!venueName.trim()) {
      setError("Please enter a venue name.");
      return;
    }
    if (!date || !time) {
      setError("Please select date and time.");
      return;
    }
    if (!venueLocation || !venueLocation.address) {
      setError("Please select a venue location (Google search).");
      return;
    }

    // parse songLimit (optional) and validate according to project rules
    let parsedSongLimit = null;
    if (String(songLimit).trim() !== "") {
      const n = parseInt(String(songLimit).trim(), 10);
      if (Number.isNaN(n)) {
        setError("Song limit must be a number.");
        return;
      }
      // Enforce project min/max (5 - 60)
      if (n < MIN_SONG_LIMIT || n > MAX_SONG_LIMIT) {
        setError(`Song limit must be between ${MIN_SONG_LIMIT} and ${MAX_SONG_LIMIT}.`);
        return;
      }
      parsedSongLimit = n;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "gigs"), {
        // 🔹 existing fields
        title: title.trim(),
        venueName: venueName.trim(),
        date,
        time,
        venueLocation: {
          name: venueName.trim(), // helpful for UIs that read venueLocation.name
          address: venueLocation.address,
          city: venueLocation.city || "",
          country: venueLocation.country || "",
          lat: venueLocation.location?.lat ?? null,
          lng: venueLocation.location?.lng ?? null,
        },
        status: "upcoming",
        createdAt: serverTimestamp(),

        // 🔹 new fields
        artistId: currentUser.uid, // associate gig with artist
        description: description.trim() || "",
        songLimit: parsedSongLimit, // number or null
        gigPlaylistId: selectedPlaylistId || null, // explicit null preserves legacy fallback behavior
        updatedAt: serverTimestamp(),
      });

      alert("Gig created!");
      navigate(-1); // keep old behaviour: go back
    } catch (err) {
      console.error("Error creating gig", err);
      setError("Error creating gig. Check console.");
    } finally {
      setSaving(false);
    }
  };

  // Helper: selected playlist preview (up to 3 tracks)
  const selectedPlaylist = gigPlaylists.find((p) => p.id === selectedPlaylistId);
  const previewTracks = selectedPlaylist ? (selectedPlaylist.tracks || []).slice(0, 3) : [];

  if (!profileOk) {
    return (
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
        Checking artist profile…
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", fontFamily: "system-ui" }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: "12px" }}>
        ⬅ Back
      </button>

      <h2>Create New Gig</h2>

      {error && (
        <div
          style={{
            marginTop: 8,
            marginBottom: 8,
            padding: 8,
            borderRadius: 6,
            background: "rgba(248,113,113,0.15)",
            border: "1px solid rgba(248,113,113,0.8)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 680,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Gig title */}
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Gig title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Friday Night Live"
            style={{ width: "100%", padding: 8, fontSize: 14 }}
          />
        </div>

        {/* Venue name (single, not duplicated now) */}
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Venue name</label>
          <input
            type="text"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Toit, Kalyani Nagar"
            style={{ width: "100%", padding: 8, fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {/* Date */}
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: 8, fontSize: 14 }}
            />
          </div>

          {/* Time */}
          <div style={{ width: 160 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ width: "100%", padding: 8, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Description (new, optional) */}
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>
            Gig description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the vibe of this gig..."
            style={{
              width: "100%",
              padding: 8,
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>

        {/* Song limit (new, optional) */}
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>
            Song limit (optional, e.g. 25)
          </label>
          <input
            type="number"
            min={MIN_SONG_LIMIT}
            max={MAX_SONG_LIMIT}
            step={1}
            value={songLimit}
            onChange={(e) => setSongLimit(e.target.value)}
            placeholder="Number of songs to target"
            style={{ width: "100%", padding: 8, fontSize: 14 }}
          />
          <p style={{ margin: 0, marginTop: 4, fontSize: 11, color: "#555" }}>
            Optional. If provided, must be between {MIN_SONG_LIMIT} and{" "}
            {MAX_SONG_LIMIT}. This is used by your playlist logic ({" "}
            <code>computeEffectivePlaylist()</code> ) to trim/supplement the final
            effective playlist.
          </p>
        </div>

        {/* Venue location */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Venue location
          </label>
          <VenueLocationPicker value={venueLocation} onChange={setVenueLocation} />
        </div>

        {/* Gig playlist selector (new) */}
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>
            Attach gig playlist (optional)
          </label>
          {loadingPlaylists ? (
            <p style={{ fontSize: 13, color: "#555" }}>Loading playlists…</p>
          ) : gigPlaylists.length === 0 ? (
            <p style={{ fontSize: 13, color: "#555" }}>
              You don't have any gig playlists yet. You can create them in{" "}
              <strong>Gig Playlists</strong>. If you leave this blank, the
              Master Playlist will be used as fallback.
            </p>
          ) : (
            <select
              value={selectedPlaylistId}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              style={{ width: "100%", padding: 8, fontSize: 14 }}
            >
              <option value="">No playlist – use Master Playlist (fallback)</option>
              {gigPlaylists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.tracks?.length || 0} songs)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected playlist preview */}
        {selectedPlaylistId && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fafafa",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>Selected playlist preview</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/artist/gig-playlists/${selectedPlaylistId}`)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Edit playlist
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/artist/master-playlist")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  View master playlist
                </button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              {previewTracks.length === 0 ? (
                <div style={{ fontSize: 13, color: "#555" }}>This playlist has no tracks yet.</div>
              ) : (
                previewTracks.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0" }}>
                    <img
                      src={t.artwork || t.cover || t.thumbnail || "/placeholder.png"}
                      alt={t.title || t.name || "track"}
                      style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.title || t.name || "Untitled"}</div>
                      <div style={{ fontSize: 13, color: "#666" }}>{t.artist || t.by || ""}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 12,
            padding: "10px 16px",
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 6,
            border: "none",
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Creating..." : "Create Gig"}
        </button>
      </form>
    </div>
  );
}

export default ArtistCreateGigPage;
