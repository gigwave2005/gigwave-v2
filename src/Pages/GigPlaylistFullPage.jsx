// src/Pages/GigPlaylistFullPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { computeEffectivePlaylist } from "../utils/playlistUtils";

export default function GigPlaylistFullPage() {
  const { gigId } = useParams();
  const navigate = useNavigate();

  const [gig, setGig] = useState(null);
  const [artist, setArtist] = useState(null);
  const [masterTracks, setMasterTracks] = useState([]);
  const [gigPlaylistTracks, setGigPlaylistTracks] = useState(null);
  const [gigPlaylistName, setGigPlaylistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [playlistMissing, setPlaylistMissing] = useState(false);

  // ─────────────────────────────────────────────
  // Load gig
  // ─────────────────────────────────────────────
  useEffect(() => {
    const loadGig = async () => {
      const snap = await getDoc(doc(db, "gigs", gigId));
      if (snap.exists()) {
        setGig({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };
    loadGig();
  }, [gigId]);

  // ─────────────────────────────────────────────
  // Load artist + master playlist
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!gig?.artistId) return;

    const loadArtist = async () => {
      const artistSnap = await getDoc(
        doc(db, "artists", gig.artistId)
      );
      if (artistSnap.exists()) {
        setArtist({ id: artistSnap.id, ...artistSnap.data() });
      }

      const masterSnap = await getDocs(
        collection(db, "artists", gig.artistId, "masterPlaylist")
      );
      setMasterTracks(
        masterSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    };

    loadArtist();
  }, [gig]);

  // ─────────────────────────────────────────────
  // Load attached gig playlist (if any)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!gig?.artistId) return;

    const loadGigPlaylist = async () => {
      // Saved gig playlist
      if (gig.gigPlaylistId) {
        const ref = doc(
          db,
          "artists",
          gig.artistId,
          "gigPlaylists",
          gig.gigPlaylistId
        );
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setGigPlaylistTracks(Array.isArray(data.tracks) ? data.tracks : []);
          setGigPlaylistName(data.name || "Gig Playlist");
        } else {
          // Playlist deleted externally
          setPlaylistMissing(true);
          setGigPlaylistTracks(null);
        }
      }
      // Embedded legacy playlist
      else if (Array.isArray(gig.gigPlaylist)) {
        setGigPlaylistTracks(gig.gigPlaylist);
        setGigPlaylistName("Embedded Gig Playlist");
      }
    };

    loadGigPlaylist();
  }, [gig]);

  // ─────────────────────────────────────────────
  // Compute effective playlist
  // ─────────────────────────────────────────────
  const effectivePlaylist = useMemo(() => {
    if (!gig) return [];

    const gigInput = {
      ...gig,
      playlist: gigPlaylistTracks ?? null,
    };

    const artistInput = {
      ...artist,
      masterPlaylist: masterTracks,
    };

    return computeEffectivePlaylist(gigInput, artistInput);
  }, [gig, artist, gigPlaylistTracks, masterTracks]);

  // ─────────────────────────────────────────────
  // Helpers for source detection
  // ─────────────────────────────────────────────
  const makeKey = (t) =>
    t?.itunesId
      ? `i:${t.itunesId}`
      : `${(t?.title || "").toLowerCase()}|${(t?.artist ||
          t?.artistName ||
          "").toLowerCase()}`;

  const gigKeys = new Set(
    (gigPlaylistTracks || []).map((t) => makeKey(t))
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 16 }}>Loading playlist…</div>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#06000D,#180024,#280038)",
        color: "white",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      <button
        onClick={() => navigate(-1)}
        style={{
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.4)",
          background: "transparent",
          color: "white",
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        ← Back to gig
      </button>

      <h2 style={{ marginTop: 0 }}>Full Playlist</h2>

      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
        {playlistMissing
          ? "Attached playlist was deleted — using Master Playlist"
          : gigPlaylistName
          ? `Using: ${gigPlaylistName}`
          : "Using: Master Playlist (fallback)"}
      </div>

      {effectivePlaylist.length === 0 ? (
        <p>No tracks available.</p>
      ) : (
        <ol style={{ padding: 0, margin: 0 }}>
          {effectivePlaylist.map((track, index) => {
            const source = gigKeys.has(makeKey(track))
              ? "gig"
              : "master";

            return (
              <li
                key={index}
                style={{
                  listStyle: "none",
                  display: "flex",
                  gap: 12,
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {track.title || track.name || `Track ${index + 1}`}
                  </div>
                  {(track.artist || track.artistName) && (
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {track.artist || track.artistName}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      source === "gig"
                        ? "rgba(16,185,129,0.2)"
                        : "rgba(245,158,11,0.2)",
                    color:
                      source === "gig" ? "#34d399" : "#f59e0b",
                  }}
                >
                  {source === "gig"
                    ? "Gig playlist"
                    : "Supplement — Master"}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
