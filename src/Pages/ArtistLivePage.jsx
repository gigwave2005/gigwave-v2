// src/Pages/ArtistLivePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../config/firebase";
import BottomNav from "../components/BottomNav";

// Initialize Cloud Functions (uses default region)
const functionsInstance = getFunctions();

// Format Firestore timestamp nicely
function formatTime(ts) {
  if (!ts) return "";
  if (ts.toDate) {
    return ts
      .toDate()
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ArtistLivePage = ({ onBack: propOnBack, gigId: propGigId }) => {
  const params = useParams();
  const navigate = useNavigate();
  const gigId = propGigId || params.gigId;

  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [requests, setRequests] = useState([]);
  const [voteCounts, setVoteCounts] = useState({});
  const [processing, setProcessing] = useState({}); // requestId -> boolean

  // ---- Live gig doc (includes nowPlaying & stats) ----
  useEffect(() => {
    if (!gigId) return;
    const ref = doc(db, "gigs", gigId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setGig({ id: snap.id, ...snap.data() });
        } else {
          setGig(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Gig doc error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [gigId]);

  // ---- Live requests ----
  useEffect(() => {
    if (!gigId) return;
    const reqRef = collection(db, "gigs", gigId, "requests");
    const unsub = onSnapshot(
      reqRef,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setRequests(arr);
      },
      (err) => console.error("Requests snapshot error:", err)
    );
    return () => unsub();
  }, [gigId]);

  // ---- Live votes ----
  useEffect(() => {
    if (!gigId) return;
    const votesRef = collection(db, "gigs", gigId, "votes");
    const unsub = onSnapshot(
      votesRef,
      (snap) => {
        const counts = {};
        snap.forEach((d) => {
          const data = d.data();
          const reqId = data.requestId;
          if (!reqId) return;
          counts[reqId] = (counts[reqId] || 0) + 1;
        });
        setVoteCounts(counts);
      },
      (err) => console.error("Votes snapshot err:", err)
    );
    return () => unsub();
  }, [gigId]);

  // ---- Derived sorted requests: most votes first, then oldest ----
  const sortedRequests = useMemo(() => {
    const list = [...requests];
    list.sort((a, b) => {
      const va = voteCounts[a.id] || 0;
      const vb = voteCounts[b.id] || 0;
      if (va !== vb) return vb - va; // higher votes first
      const ta = a.createdAt?.seconds || a.createdAt || 0;
      const tb = b.createdAt?.seconds || b.createdAt || 0;
      return ta - tb; // older first
    });
    return list;
  }, [requests, voteCounts]);

  const nowPlaying = gig?.nowPlaying || null;
  const playlist =
    Array.isArray(gig?.playlist) && gig.playlist.length > 0
      ? gig.playlist
      : [];

  const setBusy = (id, v) =>
    setProcessing((prev) => ({ ...prev, [id]: v }));

  const handleBack = () => {
    if (propOnBack) propOnBack();
    else navigate(-1);
  };

  // ---- Cloud Function wrappers ----
  const callAcceptRequest = async (req) => {
    setBusy(req.id, true);
    try {
      const fn = httpsCallable(functionsInstance, "acceptRequest");
      await fn({ gigId, requestId: req.id });
    } catch (e) {
      console.error("acceptRequest error:", e);
      alert("Could not accept request.");
    } finally {
      setBusy(req.id, false);
    }
  };

  const callRejectRequest = async (req) => {
    setBusy(req.id, true);
    try {
      const fn = httpsCallable(functionsInstance, "rejectRequest");
      await fn({ gigId, requestId: req.id });
    } catch (e) {
      console.error("rejectRequest error:", e);
      alert("Could not reject request.");
    } finally {
      setBusy(req.id, false);
    }
  };

  const callMarkPlayed = async (req) => {
    setBusy(req.id, true);
    try {
      const fn = httpsCallable(functionsInstance, "markPlayed");
      await fn({ gigId, requestId: req.id });
    } catch (e) {
      console.error("markPlayed error:", e);
      alert("Could not mark as played.");
    } finally {
      setBusy(req.id, false);
    }
  };

  const callSetNowPlaying = async (req) => {
    setBusy(req.id, true);
    try {
      const fn = httpsCallable(functionsInstance, "setNowPlaying");
      await fn({ gigId, requestId: req.id });
    } catch (e) {
      console.error("setNowPlaying error:", e);
      alert("Could not set Now Playing.");
    } finally {
      setBusy(req.id, false);
    }
  };

  const callEndGig = async () => {
  if (!gigId) return;

  const confirmEnd = window.confirm(
    "Are you sure you want to end this gig?\n\nThis will lock the live session for the audience."
  );

  if (!confirmEnd) return;

  try {
    const fn = httpsCallable(functionsInstance, "endGig");
    await fn({ gigId });

    alert("Gig ended successfully.");
    navigate(-1);
  } catch (e) {
    console.error("endGig error:", e);
    alert("Could not end gig. Please try again.");
  }
};

  const acceptTop = async () => {
    if (sortedRequests.length === 0) return;
    await callAcceptRequest(sortedRequests[0]);
  };

  // ---- Render states ----
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "black",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "system-ui",
        }}
      >
        Loading live session…
      </div>
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
            onClick={handleBack}
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
          <p>No gig found.</p>
        </div>
        <BottomNav />
      </>
    );
  }

  // ---- MAIN UI ----
  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#06000D,#180024,#280038)",
          color: "white",
          fontFamily: "system-ui",
          paddingBottom: 90,
        }}
      >
        {/* Top header */}
        <div
          style={{
            padding: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.5)",
              background: "rgba(0,0,0,0.4)",
              color: "white",
              fontSize: 12,
            }}
          >
            ← Back
          </button>

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                opacity: 0.8,
              }}
            >
              Artist Console
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                textShadow: "0 0 10px rgba(255,0,200,0.7)",
              }}
            >
              {gig.title || "Live Gig"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.7,
              }}
            >
              {gig.venueName || gig.venueLocation?.name || "Venue"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={acceptTop}
              disabled={gig.status !== "live"}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(90deg,#22c55e,#16a34a)",
                color: "black",
                fontWeight: 700,
                fontSize: 12,
                opacity: gig.status === "live" ? 1 : 0.5,
                cursor: gig.status === "live" ? "pointer" : "default",
              }}
            >
              Accept Top
            </button>

            {gig.status === "live" && (
              <button
                onClick={callEndGig}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(248,113,113,0.9)",
                  background: "transparent",
                  color: "#fecaca",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                End Gig
              </button>
            )}
          </div>
          </div> {/* ✅ CLOSE HEADER CONTAINER */}

        {/* Split-view dashboard */}
        <div
          style={{
            padding: 12,
            display: "flex",
            gap: 12,
            overflowX: "auto",
          }}
        >
          {/* Column 1: Now Playing + Stats */}
          <div
            style={{
              minWidth: 260,
              maxWidth: 320,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Now Playing card */}
            <div
              style={{
                padding: 12,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,64,175,0.9))",
                border: "1px solid rgba(125,211,252,0.8)",
                boxShadow: "0 0 16px rgba(56,189,248,0.7)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>🎵</span>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      opacity: 0.9,
                    }}
                  >
                    Now Playing
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.8,
                    }}
                  >
                    {gig.status === "live" ? "Live" : "Not live"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 8,
                  borderRadius: 12,
                  background: "rgba(15,23,42,0.8)",
                  minHeight: 48,
                }}
              >
                {nowPlaying?.songName ? (
                  <>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      {nowPlaying.songName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.8,
                      }}
                    >
                      Source:{" "}
                      {nowPlaying.type === "request"
                        ? "Crowd Request"
                        : "Manual"}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.8,
                    }}
                  >
                    No track selected yet. Accept a request or tap
                    &quot;Set Now Playing&quot; on a card.
                  </div>
                )}
              </div>
            </div>

            {/* Stats card */}
            <div
              style={{
                padding: 12,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg,rgba(24,24,27,0.95),rgba(39,39,42,0.95))",
                border: "1px solid rgba(161,161,170,0.7)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  opacity: 0.9,
                  marginBottom: 8,
                }}
              >
                Request Stats
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    Accepted
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#4ade80",
                    }}
                  >
                    {gig.acceptedRequestsCount || 0}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    Rejected
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#fb7185",
                    }}
                  >
                    {gig.rejectedRequestsCount || 0}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    Played
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#fbbf24",
                    }}
                  >
                    {gig.playedRequestsCount || 0}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    Total Requests
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                    }}
                  >
                    {requests.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Requests Queue */}
          <div
            style={{
              minWidth: 320,
              flexShrink: 0,
              maxWidth: 400,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,64,175,0.5))",
                border: "1px solid rgba(148,163,184,0.7)",
                boxShadow: "0 0 16px rgba(148,163,184,0.4)",
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      opacity: 0.9,
                    }}
                  >
                    Crowd Requests
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    Sorted by votes, then time
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.7)",
                  }}
                >
                  {sortedRequests.length} items
                </span>
              </div>

              {sortedRequests.length === 0 ? (
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                  No requests yet. Tell the crowd to scan your QR code and
                  start requesting songs.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {sortedRequests.map((req) => {
                    const votes = voteCounts[req.id] || 0;
                    const loadingReq = processing[req.id];
                    const status = req.status || "pending";
                    const isPlayed = status === "played";
                    const isAccepted = status === "accepted";
                    const isRejected = status === "rejected";

                    return (
                      <div
                        key={req.id}
                        style={{
                          padding: 10,
                          borderRadius: 14,
                          background:
                            "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(17,24,39,0.95))",
                          border: "1px solid rgba(148,163,184,0.7)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: 14,
                                }}
                              >
                                {req.songName || "Song request"}
                              </strong>
                              {req.custom && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                    border:
                                      "1px solid rgba(251,191,36,0.9)",
                                    color: "#facc15",
                                  }}
                                >
                                  CUSTOM
                                </span>
                              )}
                            </div>

                            {req.message && (
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  fontSize: 12,
                                  opacity: 0.85,
                                }}
                              >
                                “{req.message}”
                              </p>
                            )}

                            <p
                              style={{
                                margin: "6px 0 0",
                                fontSize: 11,
                                opacity: 0.65,
                              }}
                            >
                              Status: {status} • {formatTime(req.createdAt)}
                            </p>
                          </div>

                          <div
                            style={{
                              minWidth: 120,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: 4,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                              }}
                            >
                              ⭐ {votes} vote{votes !== 1 ? "s" : ""}
                            </div>

                            <button
                              disabled={loadingReq || isAccepted || isPlayed}
                              onClick={() => callAcceptRequest(req)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 8,
                                border: "none",
                                background:
                                  "linear-gradient(90deg,#22c55e,#16a34a)",
                                color: "black",
                                fontWeight: 700,
                                fontSize: 11,
                                cursor:
                                  loadingReq || isAccepted || isPlayed
                                    ? "default"
                                    : "pointer",
                                opacity:
                                  loadingReq || isAccepted || isPlayed
                                    ? 0.4
                                    : 1,
                              }}
                            >
                              Accept
                            </button>

                            <button
                              disabled={loadingReq || isRejected || isPlayed}
                              onClick={() => callRejectRequest(req)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 8,
                                border:
                                  "1px solid rgba(248,113,113,0.8)",
                                background: "transparent",
                                color: "#fecaca",
                                fontWeight: 600,
                                fontSize: 11,
                                cursor:
                                  loadingReq || isRejected || isPlayed
                                    ? "default"
                                    : "pointer",
                                opacity:
                                  loadingReq || isRejected || isPlayed
                                    ? 0.4
                                    : 1,
                              }}
                            >
                              Reject
                            </button>

                            <button
                              disabled={loadingReq || isPlayed}
                              onClick={() => callMarkPlayed(req)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 8,
                                border: "none",
                                background: "#f97316",
                                color: "black",
                                fontWeight: 700,
                                fontSize: 11,
                                cursor:
                                  loadingReq || isPlayed
                                    ? "default"
                                    : "pointer",
                                opacity:
                                  loadingReq || isPlayed ? 0.5 : 1,
                              }}
                            >
                              Mark Played
                            </button>

                            <button
                              disabled={loadingReq}
                              onClick={() => callSetNowPlaying(req)}
                              style={{
                                padding: "3px 8px",
                                borderRadius: 8,
                                border:
                                  "1px dashed rgba(125,211,252,0.9)",
                                background: "transparent",
                                color: "#bae6fd",
                                fontWeight: 500,
                                fontSize: 10,
                                cursor: loadingReq ? "default" : "pointer",
                                opacity: loadingReq ? 0.6 : 1,
                              }}
                            >
                              Set Now Playing
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Playlist Overview */}
          <div
            style={{
              minWidth: 260,
              maxWidth: 320,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg,rgba(30,27,75,0.9),rgba(76,29,149,0.9))",
                border: "1px solid rgba(216,180,254,0.8)",
                boxShadow: "0 0 16px rgba(192,132,252,0.6)",
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      opacity: 0.9,
                    }}
                  >
                    Tonight&apos;s playlist
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.75,
                    }}
                  >
                    Read-only overview
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(216,180,254,0.9)",
                  }}
                >
                  {playlist.length} tracks
                </span>
              </div>

              {playlist.length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    opacity: 0.85,
                  }}
                >
                  No playlist attached yet. Add songs from your master
                  playlist in the artist dashboard.
                </p>
              ) : (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {playlist.map((track, idx) => {
                    const label =
                      typeof track === "string"
                        ? track
                        : track?.title || "Untitled track";
                    return (
                      <li key={idx}>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
};

export default ArtistLivePage;
