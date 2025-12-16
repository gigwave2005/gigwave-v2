// src/Pages/AudienceLivePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  serverTimestamp,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { computeEffectivePlaylist } from "../utils/playlistUtils";

/**
 * Haversine distance in km between two lat/lng points.
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return null;
  }
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AudienceLivePage = ({ gigId: propGigId, onBack }) => {
  const params = useParams();
  const navigate = useNavigate();

  // gigId can come from prop (old flow) or URL param (new flow)
  const gigId = propGigId || params.gigId;

  const [artistMasterTracks, setArtistMasterTracks] = useState([]);

  // ---- Gig state ----
  const [gig, setGig] = useState(null);
  const [loadingGig, setLoadingGig] = useState(true);

  // ⭐ Playback state (readiness only)
const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // ---- Requests / votes / reactions ----
  const [requests, setRequests] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [userVoteMap, setUserVoteMap] = useState({}); // requestId -> true
  const [recentReactions, setRecentReactions] = useState([]);

  // ---- Custom request input ----
  const [newCustomSong, setNewCustomSong] = useState("");
  const [newCustomMsg, setNewCustomMsg] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  // ---- Reactions ----
  const [sendingReaction, setSendingReaction] = useState(false);

  // ---- Geolocation / gating ----
  const [userLocation, setUserLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [locationError, setLocationError] = useState("");

  // =========================
  //   FIRESTORE LISTENERS
  // =========================

  // Gig doc
  useEffect(() => {
    if (!gigId) return;

    const gigRef = doc(db, "gigs", gigId);
    const unsub = onSnapshot(
      gigRef,
      (snap) => {
        if (snap.exists()) {
          setGig({ id: snap.id, ...snap.data() });
        } else {
          setGig(null);
        }
        setLoadingGig(false);
      },
      (err) => {
        console.error("Error loading gig:", err);
        setLoadingGig(false);
      }
    );

    return () => unsub();
  }, [gigId]);

  // ⭐ NEW: Load artist master playlist (for effective playlist supplement)
useEffect(() => {
  const fetchMaster = async () => {
    if (!gig?.artistId) {
      setArtistMasterTracks([]);
      return;
    }

    try {
      const snap = await getDocs(
        collection(db, "artists", gig.artistId, "masterPlaylist")
      );

      setArtistMasterTracks(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    } catch (err) {
      console.error("Error loading master playlist:", err);
      setArtistMasterTracks([]);
    }
  };

  fetchMaster();
}, [gig?.artistId]);

  // ⭐ NEW: Use shared helper to compute effective playlist
  const effectivePlaylist = useMemo(() => {
  if (!gig) return [];
  return computeEffectivePlaylist({
    ...gig,
    masterTracks: artistMasterTracks,
  });
}, [gig, artistMasterTracks]);

useEffect(() => {
  // No tracks → reset
  if (!effectivePlaylist || effectivePlaylist.length === 0) {
    setCurrentTrackIndex(0);
    return;
  }

  // Playlist shrank → reset index
  if (currentTrackIndex >= effectivePlaylist.length) {
    setCurrentTrackIndex(0);
  }
}, [effectivePlaylist, currentTrackIndex]);

const currentTrack =
  effectivePlaylist[currentTrackIndex] || null;

  // Requests
  useEffect(() => {
    if (!gigId) return;

    const reqRef = collection(db, "gigs", gigId, "requests");
    const unsub = onSnapshot(
      reqRef,
      (snap) => {
        const items = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

        // default sort: oldest first
        items.sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return ta - tb;
        });

        setRequests(items);
      },
      (err) => {
        console.error("Error loading requests:", err);
      }
    );

    return () => unsub();
  }, [gigId]);

  // Votes
  useEffect(() => {
    if (!gigId) return;

    const votesRef = collection(db, "gigs", gigId, "votes");
    const unsub = onSnapshot(
      votesRef,
      (snap) => {
        const counts = {};
        const userMap = {};
        const currentUser = auth.currentUser;

        snap.forEach((d) => {
          const data = d.data();
          const reqId = data.requestId;
          const uId = data.userId;
          if (!reqId) return;

          counts[reqId] = (counts[reqId] || 0) + 1;
          if (currentUser && uId === currentUser.uid) {
            userMap[reqId] = true;
          }
        });

        setVoteCounts(counts);
        setUserVoteMap(userMap);
      },
      (err) => {
        console.error("Error loading votes:", err);
      }
    );

    return () => unsub();
  }, [gigId]);

  // Reactions (floating feed)
  useEffect(() => {
    if (!gigId) return;

    const reactionsRef = collection(db, "gigs", gigId, "reactions");
    const unsub = onSnapshot(
      reactionsRef,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));

        // keep last 20
        arr.sort(
          (a, b) =>
            (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        );
        setRecentReactions(arr.slice(-20));
      },
      (err) => {
        console.error("Error loading reactions:", err);
      }
    );

    return () => unsub();
  }, [gigId]);

  // =========================
  //   LOCATION / GEOFENCE
  // =========================

  useEffect(() => {
    if (!gig) return;

    if (!("geolocation" in navigator)) {
      setLocationError("Location not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(userLoc);

        const venueLat = gig?.venueLocation?.lat;
        const venueLng = gig?.venueLocation?.lng;

        if (
          typeof venueLat === "number" &&
          typeof venueLng === "number"
        ) {
          const dist = getDistanceKm(
            userLoc.lat,
            userLoc.lng,
            venueLat,
            venueLng
          );
          setDistanceKm(dist);
        }
      },
      () => {
        setLocationError(
          "Could not access your location. You can still watch, but interaction may be limited."
        );
      }
    );
  }, [gig]);

  const isWithin5Km = useMemo(() => {
    if (distanceKm == null) return false;
    return distanceKm <= 5;
  }, [distanceKm]);

  const isLive = gig?.status === "live";
  const nowPlaying = gig?.nowPlaying || null;

  const interactiveEnabled = isLive && isWithin5Km;

  // =========================
  //   HANDLERS
  // =========================

  const handleGoBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  const handleSendReaction = async (emoji) => {
    if (!gigId) return;
    const user = auth.currentUser;

    try {
      setSendingReaction(true);
      const reactionsRef = collection(db, "gigs", gigId, "reactions");
      await addDoc(reactionsRef, {
        userId: user ? user.uid : null,
        emoji,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error sending reaction:", err);
    } finally {
      setSendingReaction(false);
    }
  };

  const handleVoteRequest = async (requestId) => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/signin", {
        state: { redirectTo: `/gig/${gigId}/live` },
      });
      return;
    }
    if (!gigId || !requestId || !interactiveEnabled) return;

    try {
      const voteId = `${requestId}_${user.uid}`;
      const voteRef = doc(db, "gigs", gigId, "votes", voteId);
      await setDoc(
        voteRef,
        {
          gigId,
          requestId,
          userId: user.uid,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error voting:", err);
    }
  };

  const handleSendCustomRequest = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/signin", {
        state: { redirectTo: `/gig/${gigId}/live` },
      });
      return;
    }

    if (!gigId || !interactiveEnabled) return;
    const trimmedSong = newCustomSong.trim();
    const trimmedMsg = newCustomMsg.trim();
    if (!trimmedSong) return;

    try {
      setSendingRequest(true);
      const reqRef = collection(db, "gigs", gigId, "requests");
      await addDoc(reqRef, {
        gigId,
        userId: user.uid,
        songName: trimmedSong,
        message: trimmedMsg || null,
        custom: true,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setNewCustomSong("");
      setNewCustomMsg("");
    } catch (err) {
      console.error("Error sending request:", err);
      alert("Could not send request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  };

  // (OLD) Playlist from gig doc – now replaced by effectivePlaylist:
  // const playlist =
  //   Array.isArray(gig?.playlist) && gig.playlist.length > 0
  //     ? gig.playlist
  //     : [];

  // =========================
  //   RENDER
  // =========================

  if (loadingGig) {
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
        Joining live gig…
      </div>
    );
  }

  if (!gig) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "black",
          color: "white",
          padding: 16,
          fontFamily: "system-ui",
        }}
      >
        <button
          onClick={handleGoBack}
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "transparent",
            color: "white",
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Back
        </button>
        <p>Live room not found for this gig.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left,#ff00d4 0,#0a0014 35%,#020008 70%,#000000 100%)",
        color: "white",
        fontFamily: "system-ui",
        paddingBottom: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Floating reactions (right side) */}
      <div
        style={{
          position: "absolute",
          right: 8,
          top: 70,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        {recentReactions.map((r) => (
          <div
            key={r.id}
            style={{
              fontSize: 18,
              animation: "floatUp 2s ease-out forwards",
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Soft glow circle */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(255,0,212,0.8),transparent 60%)",
          filter: "blur(10px)",
          opacity: 0.6,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          backdropFilter: "blur(12px)",
          background:
            "linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.6),transparent)",
          padding: "10px 14px 6px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <button
            onClick={handleGoBack}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "rgba(0,0,0,0.4)",
              color: "white",
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back
          </button>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.08,
                  background: isLive
                    ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                    : "rgba(255,255,255,0.25)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isLive ? "#22c55e" : "#9ca3af",
                    boxShadow: isLive
                      ? "0 0 10px rgba(34,197,94,0.9)"
                      : "none",
                  }}
                />
                {isLive ? "LIVE" : "Not live"}
              </span>

              {typeof distanceKm === "number" && (
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.8,
                  }}
                >
                  📍 {distanceKm.toFixed(1)} km away
                </span>
              )}
            </div>

            <h2
              style={{
                margin: "4px 0 0",
                fontSize: 18,
                fontWeight: 800,
                textShadow: "0 0 10px rgba(255,0,200,0.7)",
              }}
            >
              {gig.title || "Live gig"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.8,
              }}
            >
              {gig.venueName || gig.venueLocation?.name || "Venue"}{" "}
              {gig.venueLocation?.city
                ? `• ${gig.venueLocation.city}`
                : ""}
            </p>
          </div>
        </div>

        {/* ⭐ MINI PLAYER ⭐ */}
        {nowPlaying?.songName && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 4,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg,rgba(56,189,248,0.25),rgba(129,140,248,0.35))",
                border: "1px solid rgba(125,211,252,0.8)",
                boxShadow: "0 0 10px rgba(56,189,248,0.6)",
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 16 }}>🎵</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    opacity: 0.9,
                  }}
                >
                  Now Playing
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {nowPlaying.songName}
                </div>
              </div>

              <span
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.4)",
                  opacity: 0.9,
                }}
              >
                {nowPlaying.type === "request" ? "From crowd" : "Live"}
              </span>
            </div>
          </div>
        )}
        {/* ⭐ END MINI PLAYER ⭐ */}

        {locationError && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "#ff9fb5",
            }}
          >
            {locationError}
          </p>
        )}

        {!interactiveEnabled && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: "#e5e7eb",
              opacity: 0.8,
            }}
          >
            You&apos;re in <strong>read-only mode</strong>. You can still
            watch requests, but only people within 5 km can interact while
            the gig is live.
          </p>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div
        style={{
          padding: "12px 14px 80px",
        }}
      >
        {/* Playlist preview + quick queue */}
        <section
          style={{
            marginBottom: 16,
            borderRadius: 18,
            padding: 12,
            background:
              "linear-gradient(135deg,rgba(10,0,40,0.9),rgba(20,0,70,0.9))",
            border: "1px solid rgba(255,0,200,0.4)",
            boxShadow:
              "0 0 18px rgba(255,0,200,0.35), inset 0 0 8px rgba(255,0,200,0.15)",
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 6,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1,
              opacity: 0.9,
            }}
          >
            Tonight&apos;s playlist
          </h3>

          {effectivePlaylist.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.8,
              }}
            >
              The artist hasn&apos;t added a playlist yet.
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                fontSize: 13,
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {effectivePlaylist.map((track) => {
                let trackLabel;
                if (typeof track === "string") {
                  trackLabel = track;
                } else {
                  trackLabel =
                    track?.title ||
                    track?.name ||
                    "Untitled track";
                }

                const trackKey =
                  track.itunesId ||
                  track.id ||
                  `${trackLabel}_${track.artistName || ""}`;

                return (
                  <li
                    key={trackKey}
                    style={{
                      marginBottom: 4,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{trackLabel}</span>

                    {interactiveEnabled && (
                      <button
                        type="button"
                        onClick={() => setNewCustomSong(trackLabel)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.4)",
                          background: "transparent",
                          color: "white",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Queue this
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Crowd requests */}
        <section
          style={{
            marginBottom: 16,
            borderRadius: 18,
            padding: 12,
            background:
              "linear-gradient(135deg,rgba(4,0,20,0.9),rgba(12,0,36,0.9))",
            border: "1px solid rgba(148,163,184,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1,
                opacity: 0.9,
              }}
            >
              Crowd requests
            </h3>
            <span
              style={{
                fontSize: 11,
                opacity: 0.75,
              }}
            >
              {requests.length} request
              {requests.length === 1 ? "" : "s"}
            </span>
          </div>

          {requests.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.8,
              }}
            >
              No requests yet. Be the first to ask for a song 👇
            </p>
          ) : (
            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4,
              }}
            >
              {requests.map((req) => {
                const count = voteCounts[req.id] || 0;
                const userVoted = !!userVoteMap[req.id];

                return (
                  <div
                    key={req.id}
                    style={{
                      borderRadius: 12,
                      padding: 8,
                      background:
                        "linear-gradient(90deg,rgba(15,23,42,0.9),rgba(30,64,175,0.4))",
                      border:
                        "1px solid rgba(148,163,184,0.6)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {req.songName || "Song request"}
                        </p>
                        {req.message && (
                          <p
                            style={{
                              margin: 0,
                              marginTop: 2,
                              fontSize: 12,
                              opacity: 0.8,
                            }}
                          >
                            “{req.message}”
                          </p>
                        )}
                        {req.custom && (
                          <span
                            style={{
                              marginTop: 2,
                              display: "inline-block",
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: 0.12,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background:
                                "rgba(251,191,36,0.18)",
                              border:
                                "1px solid rgba(251,191,36,0.7)",
                              color: "#facc15",
                            }}
                          >
                            Custom
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            opacity: 0.8,
                          }}
                        >
                          {count} vote
                          {count === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          disabled={!interactiveEnabled}
                          onClick={() =>
                            handleVoteRequest(req.id)
                          }
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: userVoted
                              ? "1px solid #22c55e"
                              : "1px solid rgba(148,163,184,0.7)",
                            background: userVoted
                              ? "linear-gradient(90deg,#22c55e,#16a34a)"
                              : "rgba(15,23,42,0.9)",
                            color: userVoted
                              ? "#022c22"
                              : "white",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: interactiveEnabled
                              ? "pointer"
                              : "default",
                            opacity: interactiveEnabled ? 1 : 0.5,
                          }}
                        >
                          {userVoted ? "Voted" : "Vote"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Custom request composer */}
        <section
          style={{
            borderRadius: 18,
            padding: 12,
            background:
              "linear-gradient(135deg,rgba(10,10,24,0.95),rgba(24,0,48,0.95))",
            border: "1px solid rgba(129,140,248,0.7)",
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 6,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1,
              opacity: 0.9,
            }}
          >
            Request a song
          </h3>

          <input
            type="text"
            value={newCustomSong}
            onChange={(e) => setNewCustomSong(e.target.value)}
            placeholder="Song name or link"
            disabled={!interactiveEnabled}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.8)",
              background: "rgba(15,23,42,0.9)",
              color: "white",
              fontSize: 13,
              marginBottom: 6,
              outline: "none",
              opacity: interactiveEnabled ? 1 : 0.5,
            }}
          />

          <textarea
            value={newCustomMsg}
            onChange={(e) => setNewCustomMsg(e.target.value)}
            placeholder="Optional message to the artist (dedication, vibe, etc.)"
            disabled={!interactiveEnabled}
            rows={2}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.8)",
              background: "rgba(15,23,42,0.9)",
              color: "white",
              fontSize: 13,
              marginBottom: 8,
              outline: "none",
              resize: "none",
              opacity: interactiveEnabled ? 1 : 0.5,
            }}
          />

          <button
            type="button"
            disabled={!interactiveEnabled || sendingRequest}
            onClick={handleSendCustomRequest}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: interactiveEnabled
                ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                : "rgba(75,85,99,0.8)",
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: interactiveEnabled ? "pointer" : "default",
              boxShadow: interactiveEnabled
                ? "0 0 16px rgba(255,0,200,0.8)"
                : "none",
            }}
          >
            {sendingRequest ? "Sending…" : "Send request"}
          </button>
        </section>
      </div>

      {/* Reaction bar at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 8,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            display: "inline-flex",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(148,163,184,0.7)",
            backdropFilter: "blur(12px)",
          }}
        >
          {["👏", "🔥", "💃", "❤️"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={sendingReaction || !isLive}
              onClick={() => handleSendReaction(emoji)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 20,
                cursor: isLive ? "pointer" : "default",
                opacity: isLive ? 1 : 0.5,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* keyframes for floating emojis */}
      <style>
        {`
@keyframes floatUp {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-50px); opacity: 0; }
}
`}
      </style>
    </div>
  );
};

export default AudienceLivePage;
