// src/Pages/MyInterestedGigsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import BottomNav from "../components/BottomNav";

const MyInterestedGigsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState([]);

  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [gigToRemove, setGigToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/signin", { state: { redirectTo: location.pathname } });
        return;
      }

      try {
        const qInterests = query(
          collection(db, "gigInterests"),
          where("userId", "==", user.uid)
        );
        const snapInterests = await getDocs(qInterests);
        const gigIds = [
          ...new Set(
            snapInterests.docs.map((d) => d.data().gigId).filter(Boolean)
          ),
        ];

        if (gigIds.length === 0) {
          setGigs([]);
          return;
        }

        const gigDocs = await Promise.all(
          gigIds.map((gid) => getDoc(doc(db, "gigs", gid)))
        );

        const gigsData = gigDocs
          .filter((d) => d.exists())
          .map((d) => ({ id: d.id, ...d.data() }));

        setGigs(gigsData);
      } catch (err) {
        console.error("Error loading interested gigs:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, location.pathname]);

  const openRemoveConfirm = (gig) => {
    setGigToRemove(gig);
    setShowConfirmRemove(true);
  };

  const handleConfirmRemove = async () => {
    const user = auth.currentUser;
    if (!user || !gigToRemove) {
      setShowConfirmRemove(false);
      return;
    }

    try {
      setRemoving(true);
      const interestId = `${gigToRemove.id}_${user.uid}`;
      const interestRef = doc(db, "gigInterests", interestId);
      await deleteDoc(interestRef);

      setGigs((prev) => prev.filter((g) => g.id !== gigToRemove.id));
    } catch (err) {
      console.error("Error removing interest:", err);
      alert("Could not remove this gig. Please try again.");
    } finally {
      setRemoving(false);
      setShowConfirmRemove(false);
      setGigToRemove(null);
    }
  };

  if (loading) {
    return (
      <>
        <div
          style={{
            height: "100vh",
            background: "black",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui",
          }}
        >
          Loading your gigs…
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
          background: "linear-gradient(180deg,#0A0014,#1A0024,#2D003A)",
          padding: 16,
          paddingBottom: 90,
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 800,
              margin: 0,
              textShadow: "0 0 10px rgba(255,0,200,0.8)",
            }}
          >
            ⭐ My Interested Gigs
          </h2>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
            Gigs you want to follow and attend.
          </p>
        </div>

        {gigs.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <p style={{ fontSize: 15, opacity: 0.7 }}>
              You haven&apos;t marked any gigs yet.
            </p>
            <button
              onClick={() => navigate("/gigs")}
              style={{
                marginTop: 12,
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                fontSize: 15,
                background: "linear-gradient(90deg,#ff00d4,#8800ff)",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 16px rgba(255,0,200,0.8)",
              }}
            >
              Browse Gigs
            </button>
          </div>
        ) : (
          gigs.map((gig) => {
            const venueName =
              gig.venueName || gig.venueLocation?.name || "Venue";
            const venueAddress = gig.venueLocation?.address || "Venue TBA";

            return (
              <div
                key={gig.id}
                style={{
                  width: "100%",
                  marginBottom: 14,
                  padding: 16,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,0,200,0.25)",
                  boxShadow:
                    "0 0 10px rgba(255,0,200,0.25), inset 0 0 8px rgba(255,0,200,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div
                    style={{ flex: 1, minWidth: 0 }}
                    onClick={() => navigate(`/gigs/${gig.id}`)}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 20,
                        fontWeight: 800,
                        opacity: 0.95,
                      }}
                    >
                      {gig.title}
                    </h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span
                      style={{
                        alignSelf: "flex-end",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "white",
                        background:
                          gig.status === "live"
                            ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                            : "rgba(255,255,255,0.25)",
                      }}
                    >
                      {gig.status === "live" ? "LIVE" : "UPCOMING"}
                    </span>
                    <button
                      type="button"
                      onClick={() => openRemoveConfirm(gig)}
                      style={{
                        alignSelf: "flex-end",
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "none",
                        background: "rgba(255,80,80,0.9)",
                        color: "white",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => navigate(`/gigs/${gig.id}`)}
                  style={{ marginTop: 4 }}
                >
                  <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>
                    📍 {venueName}
                  </p>
                  <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
                    {venueAddress}
                  </p>
                  <p style={{ marginTop: 6, fontSize: 14 }}>
                    📅 {gig.date} • ⏰ {gig.time}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirm remove modal */}
      {showConfirmRemove && gigToRemove && (
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
          onClick={() => !removing && setShowConfirmRemove(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "85%",
              maxWidth: 360,
              borderRadius: 16,
              padding: 16,
              background: "rgba(10,0,25,0.98)",
              border: "1px solid rgba(255,0,200,0.5)",
              boxShadow: "0 0 18px rgba(255,0,200,0.8)",
              fontFamily: "system-ui",
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 8,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Remove from interested?
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                opacity: 0.8,
                marginBottom: 14,
              }}
            >
              <strong>{gigToRemove.title}</strong> will be removed from your
              interested list.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setShowConfirmRemove(false)}
                disabled={removing}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: "transparent",
                  color: "white",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removing}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(255,70,70,0.9)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
};

export default MyInterestedGigsPage;
