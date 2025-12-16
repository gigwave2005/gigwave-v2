// src/Pages/AudienceBrowsePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import BottomNav from "../components/BottomNav";

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

/* DEBUG START */

const AudienceBrowsePage = () => {
  const navigate = useNavigate();

  const [gigs, setGigs] = useState([]);
  const [interestCounts, setInterestCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [userLocation, setUserLocation] = useState(null);
  const [distanceFilter, setDistanceFilter] = useState(5);
  const [locationError, setLocationError] = useState("");

  const [tab, setTab] = useState("all"); // live | upcoming | all

  useEffect(() => {
    const load = async () => {
      try {
        const gigsData = gigsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((g) => !["cancelled", "ended"].includes(g.status));

        setGigs(gigsData);

        const interestSnap = await getDocs(collection(db, "gigInterests"));
        const counts = {};
        interestSnap.forEach((d) => {
          const id = d.data().gigId;
          counts[id] = (counts[id] || 0) + 1;
        });
        setInterestCounts(counts);
      } catch (err) {
        console.error("Error loading gigs:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleEnableLocation = () => {
    setLocationError("");

    if (!("geolocation" in navigator)) {
      setLocationError("Location not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setLocationError(
          "Could not access location. Please allow permission."
        );
      }
    );
  };

  const gigsWithDistance = gigs.map((g) => {
    const lat = g?.venueLocation?.lat;
    const lng = g?.venueLocation?.lng;
    let dist = null;

    if (userLocation && typeof lat === "number" && typeof lng === "number") {
      dist = getDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
    }
    return { ...g, distanceKm: dist };
  });

  // Distance filter
  let filtered = gigsWithDistance;
  if (userLocation && distanceFilter !== "all") {
    filtered = gigsWithDistance.filter(
      (g) => typeof g.distanceKm === "number" && g.distanceKm <= distanceFilter
    );
  }

  // Tab filter
  if (tab === "live") filtered = filtered.filter((g) => g.status === "live");
  if (tab === "upcoming") filtered = filtered.filter((g) => g.status !== "live");

  const renderGigCard = (gig) => {
  const venueName =
    gig.venueName || gig.venueLocation?.name || "Venue";
  const venueAddress = gig.venueLocation?.address || "Venue TBA";
  const interest = interestCounts[gig.id] || 0;

  return (
    <div
      key={gig.id}
      onClick={() => navigate(`/gig/${gig.id}`)}
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
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            padding: "4px 10px",
            fontSize: 11,
            borderRadius: 999,
            fontWeight: 700,
            background:
              gig.status === "live"
                ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                : "rgba(255,255,255,0.25)",
          }}
        >
          {gig.status === "live" ? "LIVE" : "Upcoming"}
        </span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>⭐ {interest}</span>
      </div>

      <h3 style={{ margin: "6px 0 2px", fontSize: 20, fontWeight: 800 }}>
        {gig.title}
      </h3>

      <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>{venueName}</p>
      <p style={{ margin: 0, opacity: 0.6, fontSize: 13 }}>{venueAddress}</p>
      <p style={{ marginTop: 6, fontSize: 14 }}>
        📅 {gig.date} • ⏰ {gig.time}
      </p>

      {userLocation && typeof gig.distanceKm === "number" && (
        <p style={{ fontSize: 13, marginTop: 4, color: "#00ff73" }}>
          📍 {gig.distanceKm.toFixed(1)} km away
        </p>
      )}

      {gig.status === "live" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/gig/${gig.id}/live`);
          }}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(90deg,#00ff73,#00c853)",
            color: "black",
            fontSize: 15,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          🔥 Join Live
        </button>
      )}
    </div>
  );
};

    if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#06000D,#180024,#280038)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}
      >
        Loading gigs…
      </div>
    );
  }


  return (
  <div
    style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#06000D,#180024,#280038)",
      color: "white",
      fontFamily: "system-ui",
    }}
  >
    {/* 🔙 Back button */}
    <div style={{ padding: 12 }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.3)",
          background: "transparent",
          color: "white",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        ← Back
      </button>
    </div>
    
      <div
        style={{
          background: "linear-gradient(180deg,#0A0014,#1A0024,#2D003A)",
          minHeight: "100vh",
          padding: 16,
          paddingBottom: 90,
          color: "white",
          fontFamily: "system-ui",
          overflowX: "hidden",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: 24,
            fontWeight: 800,
            marginBottom: 10,
            textShadow: "0 0 10px rgba(255,0,200,0.7)",
          }}
        >
          Live Gigs Near You
        </h2>

        {/* Enable location CTA */}
        {!userLocation && (
          <button
            type="button"
            onClick={handleEnableLocation}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            📍 Enable location to sort by nearest gigs
          </button>
        )}

        {locationError && (
          <p style={{ margin: 0, fontSize: 12, color: "#ff9fb5" }}>
            {locationError}
          </p>
        )}

        {/* Distance filter chips */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            paddingBottom: 8,
            gap: 10,
            marginTop: 10,
          }}
        >
          {[2, 5, 10, 20, "all"].map((v) => (
            <button
              key={v}
              onClick={() => setDistanceFilter(v)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                background:
                  distanceFilter === v
                    ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                    : "rgba(255,255,255,0.12)",
                border:
                  distanceFilter === v
                    ? "1px solid #ff00d4"
                    : "1px solid rgba(255,255,255,0.25)",
                color: "white",
                cursor: "pointer",
              }}
            >
              {v === "all" ? "All" : `${v} km`}
            </button>
          ))}
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 16,
            marginTop: 12,
          }}
        >
          {[
            { key: "all", label: "All" },
            { key: "live", label: "Live" },
            { key: "upcoming", label: "Upcoming" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                border:
                  tab === t.key
                    ? "1px solid #ff00d4"
                    : "1px solid rgba(255,255,255,0.25)",
                background:
                  tab === t.key
                    ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                    : "rgba(255,255,255,0.08)",
                color: "white",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Render gigs */}
        {filtered.map(renderGigCard)}
      </div>

      {/* 🔥 Animation Keyframes */}
      <style>
        {`
@keyframes pulseFire {
  0% { box-shadow: 0 0 8px rgba(0,255,140,0.5); transform: scale(1); }
  50% { box-shadow: 0 0 20px rgba(0,255,140,1); transform: scale(1.04); }
  100% { box-shadow: 0 0 8px rgba(0,255,140,0.5); transform: scale(1); }
}

@keyframes fireFlicker {
  0% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0.5; transform: translateY(-1px); }
  100% { opacity: 1; transform: translateY(0); }
}
`}
      </style>

      <BottomNav />
    </div>
  );
};

export default AudienceBrowsePage;
