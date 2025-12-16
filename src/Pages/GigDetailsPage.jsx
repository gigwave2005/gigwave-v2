// src/Pages/GigDetailsPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import BottomNav from "../components/BottomNav";
import { computeEffectivePlaylist } from "../utils/playlistUtils";

const GigDetailsPage = () => {
  const { gigId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [gig, setGig] = useState(null);
  const [loadingGig, setLoadingGig] = useState(true);

  const [alreadyInterested, setAlreadyInterested] = useState(false);
  const [checkingInterest, setCheckingInterest] = useState(true);
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestCount, setInterestCount] = useState(0);

  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  // Artist profile (basic)
  const [artistProfile, setArtistProfile] = useState(null);

  // Master + gig playlist
  const [artistMasterTracks, setArtistMasterTracks] = useState([]);
  const [gigPlaylistTracks, setGigPlaylistTracks] = useState(null);

  const [gigPlaylistName, setGigPlaylistName] = useState("");

  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingGigPlaylist, setLoadingGigPlaylist] = useState(false);

  // NEW: show full playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // ───────────────────────────────────────────────────────────────
  // Load gig
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchGig = async () => {
      try {
        const gigRef = doc(db, "gigs", gigId);
        const snapshot = await getDoc(gigRef);
        if (snapshot.exists()) {
          setGig({ id: snapshot.id, ...snapshot.data() });
        } else {
          setGig(null);
        }
      } catch (error) {
        console.error("Error fetching gig:", error);
      } finally {
        setLoadingGig(false);
      }
    };

    fetchGig();
  }, [gigId]);

  // ───────────────────────────────────────────────────────────────
  // Load artist profile
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchArtist = async () => {
      if (!gig?.artistId) {
        setArtistProfile(null);
        return;
      }

      try {
        const artistRef = doc(db, "artists", gig.artistId);
        const snapshot = await getDoc(artistRef);
        if (snapshot.exists()) {
          setArtistProfile({ id: snapshot.id, ...snapshot.data() });
        } else {
          setArtistProfile(null);
        }
      } catch (error) {
        console.error("Error fetching artist profile:", error);
        setArtistProfile(null);
      }
    };

    fetchArtist();
  }, [gig]);

  // ───────────────────────────────────────────────────────────────
  // Load master playlist
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadMaster = async () => {
      if (!gig?.artistId) return;

      setLoadingMaster(true);
      try {
        const colRef = collection(db, "artists", gig.artistId, "masterPlaylist");
        const snap = await getDocs(colRef);
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Sort alphabetically by artist then title
        list.sort((a, b) => {
          const artistA = (a.artistName || "").toLowerCase();
          const artistB = (b.artistName || "").toLowerCase();
          if (artistA < artistB) return -1;
          if (artistA > artistB) return 1;
          const titleA = (a.title || "").toLowerCase();
          const titleB = (b.title || "").toLowerCase();
          if (titleA < titleB) return -1;
          if (titleA > titleB) return 1;
          return 0;
        });

        setArtistMasterTracks(list);
      } catch (err) {
        console.error("Error loading artist master playlist:", err);
        setArtistMasterTracks([]);
      } finally {
        setLoadingMaster(false);
      }
    };

    loadMaster();
  }, [gig]);

  // ───────────────────────────────────────────────────────────────
  // Load gig playlist if attached
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadGigPlaylist = async () => {
      if (!gig || !gig.artistId) {
        setGigPlaylistTracks(null);
        setGigPlaylistName("");
        return;
      }

      if (gig.gigPlaylistId) {
        setLoadingGigPlaylist(true);
        try {
          const plRef = doc(
            db,
            "artists",
            gig.artistId,
            "gigPlaylists",
            gig.gigPlaylistId
          );
          const snap = await getDoc(plRef);
          if (snap.exists()) {
            const data = snap.data();
            let tracks = Array.isArray(data.tracks) ? data.tracks : [];

            tracks = tracks
              .map((t, index) => ({
                ...t,
                order: typeof t.order === "number" ? t.order : index,
              }))
              .sort((a, b) => (a.order || 0) - (b.order || 0));

            setGigPlaylistTracks(tracks);
            setGigPlaylistName(data.name || "");
          } else {
            setGigPlaylistTracks(null);
            setGigPlaylistName("");
          }
        } catch (err) {
          console.error("Error loading gig playlist by ID:", err);
          setGigPlaylistTracks(null);
          setGigPlaylistName("");
        } finally {
          setLoadingGigPlaylist(false);
        }
      } else if (Array.isArray(gig.gigPlaylist)) {
        const normalised = gig.gigPlaylist
          .map((t, index) => ({
            ...t,
            order: typeof t.order === "number" ? t.order : index,
          }))
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        setGigPlaylistTracks(normalised);
        setGigPlaylistName("(embedded)");
      } else {
        setGigPlaylistTracks(null);
        setGigPlaylistName("");
      }
    };

    loadGigPlaylist();
  }, [gig]);

  // ───────────────────────────────────────────────────────────────
  // Compute effective playlist (gig + supplements)
  // ───────────────────────────────────────────────────────────────
  const effectivePlaylist = useMemo(() => {
    if (!gig) return [];

    const gigWithPlaylist = gigPlaylistTracks
      ? { ...gig, playlist: gigPlaylistTracks }
      : gig;

    const artistWithPlaylist = artistProfile
      ? { ...artistProfile, masterPlaylist: artistMasterTracks }
      : { masterPlaylist: artistMasterTracks };

    return computeEffectivePlaylist(gigWithPlaylist, artistWithPlaylist);
  }, [gig, artistProfile, gigPlaylistTracks, artistMasterTracks]);

  // ───────────────────────────────────────────────────────────────
  // Detect supplementation
  // ───────────────────────────────────────────────────────────────
  const makeKey = (t) => {
    if (!t) return null;
    if (t.itunesId) return `itunes:${t.itunesId}`;
    const title = (t.title || "").toLowerCase().trim();
    const artist = (t.artist || t.artistName || "").toLowerCase().trim();
    return `${title}|${artist}`;
  };

  const gigKeys = new Set(
    (gigPlaylistTracks || []).map((t) => makeKey(t))
  );

  const previewLimit = gig?.songLimit || 10;

  const previewTracksWithSource = useMemo(() => {
    const eff = effectivePlaylist.slice(0, previewLimit);

    return eff.map((track, index) => {
      const key = makeKey(track);
      const source =
        gigKeys.size > 0 && gigKeys.has(key) ? "gig" : "master";
      return { track, source, index };
    });
  }, [effectivePlaylist, previewLimit, gigKeys]);

  // full playlist with source inference for modal
  const fullPlaylistWithSource = useMemo(() => {
    if (!effectivePlaylist || effectivePlaylist.length === 0) return [];
    return effectivePlaylist.map((track, index) => {
      const key = makeKey(track);
      const source = gigKeys.size > 0 && gigKeys.has(key) ? "gig" : "master";
      return { track, source, index };
    });
  }, [effectivePlaylist, gigKeys]);

  const usedGigPlaylist = Boolean(
    gig && (gig.gigPlaylistId || Array.isArray(gig.gigPlaylist))
  );

  const supplemented =
    usedGigPlaylist &&
    previewTracksWithSource.some((p) => p.source === "master");

  const badgeText = (() => {
    if (!gig) return "";
    if (gig.gigPlaylistId && gigPlaylistTracks?.length > 0) {
      const name = gigPlaylistName || "Attached playlist";
      return supplemented
        ? `Using: ${name} — supplemented`
        : `Using: ${name}`;
    }
    if (Array.isArray(gig.gigPlaylist) && gig.gigPlaylist.length > 0) {
      return supplemented
        ? "Using: Embedded playlist — supplemented"
        : "Using: Embedded playlist";
    }
    return "Using: Master Playlist (fallback)";
  })();

  // ───────────────────────────────────────────────────────────────
  // Interest handling
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkInterest = async () => {
      setCheckingInterest(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          setAlreadyInterested(false);
          return;
        }

        const interestId = `${gigId}_${user.uid}`;
        const ref = doc(db, "gigInterests", interestId);
        const snap = await getDoc(ref);
        setAlreadyInterested(snap.exists());
      } catch (err) {
        console.error("Error checking interest:", err);
      } finally {
        setCheckingInterest(false);
      }
    };

    checkInterest();
  }, [gigId]);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const qInterests = query(
          collection(db, "gigInterests"),
          where("gigId", "==", gigId)
        );
        const snap = await getDocs(qInterests);
        setInterestCount(snap.size);
      } catch (err) {
        console.error("Error loading interest count:", err);
      }
    };

    loadCount();
  }, [gigId]);

  const handleJoinLive = () => navigate(`/gig/${gigId}/live`);

  const handleToggleInterest = async () => {
    const user = auth.currentUser;

    if (!user) {
      navigate("/signin", { state: { redirectTo: location.pathname } });
      return;
    }

    if (!gig) return;

    if (alreadyInterested) {
      setShowConfirmRemove(true);
      return;
    }

    try {
      setSavingInterest(true);

      const interestId = `${gigId}_${user.uid}`;
      const ref = doc(db, "gigInterests", interestId);

      await setDoc(
        ref,
        {
          gigId,
          userId: user.uid,
          status: "interested",
          createdAt: serverTimestamp(),
          gigTitle: gig.title,
          venueName: gig.venueName,
        },
        { merge: true }
      );

      setAlreadyInterested(true);
      setInterestCount((prev) => prev + 1);
    } catch (err) {
      console.error("Error saving interest:", err);
      alert("Could not mark as interested.");
    } finally {
      setSavingInterest(false);
    }
  };

  const handleConfirmRemove = async () => {
    const user = auth.currentUser;
    if (!user || !gig) {
      setShowConfirmRemove(false);
      return;
    }

    try {
      setSavingInterest(true);
      const interestId = `${gigId}_${user.uid}`;
      const ref = doc(db, "gigInterests", interestId);

      await deleteDoc(ref);

      setAlreadyInterested(false);
      setInterestCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error("Error removing interest:", err);
      alert("Could not remove interest.");
    } finally {
      setSavingInterest(false);
      setShowConfirmRemove(false);
    }
  };

  // ───────────────────────────────────────────────────────────────
  // RENDERING
  // ───────────────────────────────────────────────────────────────
  if (loadingGig) {
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
          }}
        >
          Loading gig…
        </div>
        <BottomNav />
      </>
    );
  }

  if (!gig) {
    return (
      <>
        <div
          style={{
            minHeight: "100vh",
            background: "black",
            color: "white",
            padding: 16,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "transparent",
              color: "white",
              marginBottom: 12,
            }}
          >
            ← Back
          </button>
          <p>Gig not found.</p>
        </div>
        <BottomNav />
      </>
    );
  }

  const venueAddress = gig.venueLocation?.address || "Venue TBA";
  const venueName = gig.venueName || gig.venueLocation?.name || "Venue";

  const buttonDisabled = savingInterest || checkingInterest;
  const buttonLabel = checkingInterest
    ? "Checking…"
    : savingInterest
    ? "Saving…"
    : alreadyInterested
    ? "Interested ✓"
    : "Mark as Interested";

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#06000D,#180024,#280038)",
          color: "white",
          fontFamily: "system-ui",
          paddingBottom: 24,
        }}
      >
        {/* Hero section */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 260,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "url('https://images.unsplash.com/photo-1511193311914-0346f16efe90?q=80&w=1200')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "brightness(0.45)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85), rgba(40,0,80,0.6), rgba(0,0,0,0.2))",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              right: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(0,0,0,0.35)",
                color: "white",
                fontSize: 12,
              }}
            >
              ← Back
            </button>

            <span style={{ opacity: 0.9 }}>⭐ {interestCount} interested</span>
          </div>

          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 18,
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background:
                  gig.status === "live"
                    ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                    : "rgba(255,255,255,0.35)",
              }}
            >
              {gig.status === "live" ? "LIVE" : "Upcoming"}
            </span>

            <h1
              style={{
                marginTop: 8,
                marginBottom: 4,
                fontSize: 22,
                fontWeight: 800,
                textShadow: "0 0 10px rgba(255,0,200,0.8)",
              }}
            >
              {gig.title}
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              📅 {gig.date} • ⏰ {gig.time}
            </p>
          </div>
        </div>

        {/* Main content */}
        <div style={{ marginTop: -20, padding: 16 }}>
          <div
            style={{
              borderRadius: 18,
              padding: 16,
              background: "rgba(10,0,25,0.9)",
              border: "1px solid rgba(255,0,200,0.35)",
              boxShadow:
                "0 0 14px rgba(255,0,200,0.35), inset 0 0 8px rgba(255,0,200,0.18)",
            }}
          >
            {/* Venue */}
            <section style={{ marginBottom: 14 }}>
              <h3
                style={{
                  margin: 0,
                  marginBottom: 6,
                  fontSize: 15,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.9,
                }}
              >
                Venue
              </h3>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                {venueName}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  opacity: 0.7,
                  marginTop: 2,
                }}
              >
                {venueAddress}
              </p>
            </section>

            {/* About */}
            <section style={{ marginBottom: 14 }}>
              <h3
                style={{
                  margin: 0,
                  marginBottom: 6,
                  fontSize: 15,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.9,
                }}
              >
                About this gig
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.4,
                  opacity: 0.9,
                }}
              >
                {gig.description || "No description provided yet."}
              </p>
            </section>

            {/* Playlist badge + actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#eef2ff",
                  color: "#3730a3",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {badgeText}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {gig.gigPlaylistId ? (
                  <Link
                    to={`/artist/gig-playlists/${gig.gigPlaylistId}`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.06)",
                      textDecoration: "none",
                      color: "white",
                      fontSize: 13,
                      background: "transparent",
                    }}
                  >
                    View Gig Playlist
                  </Link>
                ) : (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px dashed rgba(255,255,255,0.06)",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    No attached gig playlist
                  </div>
                )}

                {gig.artistId && (
                  <Link
                    to={`/artist/master-playlist`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.06)",
                      textDecoration: "none",
                      color: "white",
                      fontSize: 13,
                      background: "transparent",
                    }}
                  >
                    View Master Playlist
                  </Link>
                )}

                {/* NEW — open the inline modal to show the full effective playlist */}
                {effectivePlaylist?.length > 0 && (
                  <button
                    onClick={() => setShowPlaylistModal(true)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "transparent",
                      color: "white",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    View full playlist
                  </button>
                )}
              </div>
            </div>

            {/* Playlist preview */}
            <section style={{ marginBottom: 16 }}>
              <h3
                style={{
                  margin: 0,
                  marginBottom: 6,
                  fontSize: 15,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.9,
                }}
              >
                Playlist preview
              </h3>

              {effectivePlaylist?.length > 0 ? (
                <ol style={{ margin: 0, paddingLeft: 0, marginTop: 8 }}>
                  {previewTracksWithSource.map((p) => {
                    const { track, source, index } = p;

                    const title =
                      track.title || track.name || `Track ${index + 1}`;
                    const artist = track.artist || track.artistName || "";
                    const artwork =
                      track.artworkUrl || track.artwork || track.image || null;

                    return (
                      <li
                        key={track.id || `${index}-${title}`}
                        style={{
                          listStyle: "none",
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          marginBottom: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div
                          style={{
                            width: 54,
                            height: 54,
                            borderRadius: 8,
                            background: "#111",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {artwork ? (
                            <img
                              src={artwork}
                              alt={title}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.6)",
                              }}
                            >
                              No image
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {title}
                          </div>

                          {artist && (
                            <div
                              style={{
                                fontSize: 13,
                                marginTop: 4,
                                color: "rgba(255,255,255,0.75)",
                              }}
                            >
                              {artist}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            padding: "6px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            background:
                              source === "gig"
                                ? "rgba(16,185,129,0.12)"
                                : "rgba(245,158,11,0.08)",
                            color:
                              source === "gig" ? "#34d399" : "#f59e0b",
                            border: "1px solid rgba(255,255,255,0.04)",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
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
              ) : (
                <p style={{ opacity: 0.7 }}>Playlist preview coming soon.</p>
              )}
            </section>

            {supplemented && (
              <p style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Note: Some tracks were supplemented from the Master Playlist.
              </p>
            )}

            {/* Join live button */}
            {gig.status === "live" && (
              <button
                onClick={handleJoinLive}
                style={{
                  width: "100%",
                  marginTop: 10,
                  padding: "12px 16px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(90deg,#22c55e,#16a34a)",
                  color: "black",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Join Live Interaction
              </button>
            )}

            {/* Interested button */}
            <button
              onClick={handleToggleInterest}
              disabled={buttonDisabled}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "12px 16px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 700,
                cursor: buttonDisabled ? "default" : "pointer",
                border: alreadyInterested
                  ? "1px solid rgba(255,0,200,0.8)"
                  : "none",
                background: alreadyInterested
                  ? "transparent"
                  : "linear-gradient(90deg,#ff00d4,#8800ff)",
                color: "white",
                boxShadow: alreadyInterested
                  ? "0 0 12px rgba(255,0,200,0.6)"
                  : "0 0 14px rgba(255,0,200,0.8)",
              }}
            >
              {buttonLabel}
            </button>

            <p
              style={{
                textAlign: "center",
                marginTop: 8,
                fontSize: 11,
                opacity: 0.6,
              }}
            >
              Sign in to sync interest across devices.
            </p>
          </div>
        </div>
      </div>

      {/* Full playlist modal */}
      {showPlaylistModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPlaylistModal(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 920,
              maxHeight: "90vh",
              overflow: "auto",
              background: "linear-gradient(180deg,#0b0720,#120828)",
              borderRadius: 12,
              padding: 18,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: "white" }}>Full effective playlist</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowPlaylistModal(false)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <p style={{ color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
              This is the effective playlist computed for this gig — it shows which tracks come from the attached Gig Playlist and which were supplemented from the Master Playlist.
            </p>

            <div style={{ marginTop: 12 }}>
              {fullPlaylistWithSource.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.7)" }}>No tracks available.</div>
              ) : (
                <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {fullPlaylistWithSource.map((p) => {
                    const { track, source, index } = p;
                    const title = track.title || track.name || `Track ${index + 1}`;
                    const artist = track.artist || track.artistName || "";
                    const artwork = track.artworkUrl || track.artwork || track.image || null;
                    const isSupplement = source !== "gig";

                    return (
                      <li key={track.id || `${index}-${title}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                        <div style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", background: "#111", flexShrink: 0 }}>
                          {artwork ? (
                            <img src={artwork} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                              No image
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontWeight: 800, color: "white" }}>{index + 1}. {title}</div>
                            <div style={{ marginLeft: "auto" }}>
                              <span style={{ padding: "6px 8px", borderRadius: 999, background: isSupplement ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.12)", color: isSupplement ? "#f59e0b" : "#34d399", fontWeight: 700 }}>
                                {isSupplement ? "Supplement — Master" : "Gig playlist"}
                              </span>
                            </div>
                          </div>

                          {artist ? <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{artist}</div> : null}

                          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            {track.masterTrackId ? <span style={{ marginRight: 8 }}>masterId: {String(track.masterTrackId).slice(0, 8)}</span> : null}
                            {track.source ? <span style={{ marginRight: 8 }}>source: {track.source}</span> : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove interest modal */}
      {showConfirmRemove && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => !savingInterest && setShowConfirmRemove(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "85%",
              maxWidth: 360,
              borderRadius: 16,
              padding: 16,
              background: "rgba(10,0,25,0.98)",
              border: "1px solid rgba(255,255,255,0.5)",
              boxShadow: "0 0 18px rgba(255,0,200,0.8)",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>Remove interest?</h3>
            <p style={{ margin: 0, marginBottom: 14, opacity: 0.8 }}>
              This will remove this gig from your interested list.
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowConfirmRemove(false)}
                disabled={savingInterest}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: "transparent",
                  color: "white",
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmRemove}
                disabled={savingInterest}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(255,70,70,0.9)",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                {savingInterest ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
};

export default GigDetailsPage;
