// src/Pages/DiscoverPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

const MAX_JOIN_DISTANCE_KM = 1;   // must be within 1km to join live gig
const NEARBY_RADIUS_KM = 50;      // nearby tab shows gigs within 50km

// Haversine distance in km
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map Firestore doc into the shape Discover expects
function mapGigDoc(docSnap) {
  const data = docSnap.data() || {};
  const venue = data.venueLocation || {};

  // Our create-gig writes venueLocation.lat / lng
  const location =
    typeof venue.lat === "number" && typeof venue.lng === "number"
      ? { lat: venue.lat, lng: venue.lng }
      : data.location || null; // fallback if old schema

  return {
    id: docSnap.id,
    artistName: data.artistName || data.title || "Unknown Artist",
    venueName: venue.address || data.venueName || "Unknown Venue",
    date: data.date || "",
    time: data.time || "",
    status: data.status || "",
    location,
  };
}

const DiscoverPage = ({ onBack, onJoinGig }) => {
  const [liveGigs, setLiveGigs] = useState([]);
  const [upcomingGigs, setUpcomingGigs] = useState([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const [activeTab, setActiveTab] = useState("live"); // "live" | "upcoming" | "all" | "nearby"

  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [nearbyGigs, setNearbyGigs] = useState([]);

  const navigate = useNavigate();

  // 🔴 LIVE gigs – realtime from Firestore (status === "live")
  useEffect(() => {
    const q = query(collection(db, "gigs"), where("status", "==", "live"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gigs = snapshot.docs.map(mapGigDoc);
        setLiveGigs(gigs);
        setLoadingLive(false);
      },
      (err) => {
        console.error("Error listening to live gigs", err);
        setLoadingLive(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // 🔵 UPCOMING gigs – realtime from Firestore (status === "upcoming")
  useEffect(() => {
    const q = query(
      collection(db, "gigs"),
      where("status", "==", "upcoming")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gigs = snapshot.docs.map(mapGigDoc);
        setUpcomingGigs(gigs);
        setLoadingUpcoming(false);
      },
      (err) => {
        console.error("Error listening to upcoming gigs", err);
        setLoadingUpcoming(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Ask for location and compute nearby gigs
  const ensureLocationAndComputeNearby = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    if (userLocation) {
      computeNearby(userLocation, liveGigs, upcomingGigs);
      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(loc);
        setLocating(false);
        computeNearby(loc, liveGigs, upcomingGigs);
      },
      (err) => {
        console.error("Error getting location", err);
        setLocating(false);
        setLocationError(
          "Could not get your location. Please allow location access."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const computeNearby = (loc, liveList, upcomingList) => {
    if (!loc) return;

    const allWithCoords = [...liveList, ...upcomingList].filter(
      (gig) =>
        gig.location &&
        typeof gig.location.lat === "number" &&
        typeof gig.location.lng === "number"
    );

    const withDistance = allWithCoords
      .map((gig) => {
        const d = calculateDistanceKm(
          loc.lat,
          loc.lng,
          gig.location.lat,
          gig.location.lng
        );
        return { gig, distanceKm: d };
      })
      .filter((item) => item.distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    setNearbyGigs(withDistance);
  };

  // Run location & nearby when switching to "nearby" tab
  useEffect(() => {
    if (activeTab === "nearby") {
      ensureLocationAndComputeNearby();
    }
    // recalc when gigs or tab change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, liveGigs, upcomingGigs]);

  const openGig = (gig, isLive, distanceKm) => {
    // For live gigs with join logic + geofence
    if (isLive && onJoinGig) {
      // If we know distance and it's > 1km, block join
      if (typeof distanceKm === "number") {
        if (distanceKm > MAX_JOIN_DISTANCE_KM) {
          alert(
            `You are ${distanceKm.toFixed(
              1
            )} km away from the venue. You must be within ${MAX_JOIN_DISTANCE_KM} km to join this live gig.`
          );
          return;
        }
      } else if (
        userLocation &&
        gig.location &&
        typeof gig.location.lat === "number" &&
        typeof gig.location.lng === "number"
      ) {
        // Compute distance on the fly if not provided
        const d = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          gig.location.lat,
          gig.location.lng
        );
        if (d > MAX_JOIN_DISTANCE_KM) {
          alert(
            `You are ${d.toFixed(
              1
            )} km away from the venue. You must be within ${MAX_JOIN_DISTANCE_KM} km to join this live gig.`
          );
          return;
        }
      }
      // Allowed to join live gig
      onJoinGig(gig.id);
      return;
    }

    // Router-based navigation (for upcoming or when no onJoinGig is passed)
    navigate("/audience-live", {
      state: { gig, gigId: gig.id },
    });
  };

  const renderLiveSection = () => {
  if (loadingLive) return <p>Loading live gigs…</p>;
  if (liveGigs.length === 0) return <p>No live gigs right now.</p>;

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {liveGigs.map((gig) => (
        <li
          key={gig.id}
          style={{
            border: "1px solid #ddd",
            padding: "10px",
            marginBottom: "8px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          onClick={() => openGig(gig, true)}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <strong>{gig.artistName || gig.title || "Unknown Artist"}</strong>

            {/* Green LIVE badge */}
            <span
              style={{
                backgroundColor: "#16a34a", // green
                color: "white",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                textTransform: "uppercase",
              }}
            >
              Live
            </span>
          </div>

          <div style={{ fontSize: 13 }}>
            {gig.venueName || "Unknown Venue"}
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            {gig.date} {gig.time && `at ${gig.time}`}
          </div>
        </li>
      ))}
    </ul>
  );
};

  const renderUpcomingSection = () => {
    if (loadingUpcoming) return <p>Loading upcoming gigs…</p>;
    if (upcomingGigs.length === 0) return <p>No upcoming gigs added yet.</p>;

    return (
      <ul style={{ listStyle: "none", padding: 0 }}>
        {upcomingGigs.map((gig) => (
          <li
            key={gig.id}
            style={{
              border: "1px solid #ddd",
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => openGig(gig, false)}
          >
            <strong>{gig.artistName || "Unknown Artist"}</strong>
            <div>{gig.venueName || "Unknown Venue"}</div>
            <div>
              {gig.date} at {gig.time}
            </div>
            <div>Status: {gig.status}</div>
          </li>
        ))}
      </ul>
    );
  };

  const renderNearbySection = () => {
    if (locating) return <p>Getting your location…</p>;
    if (locationError) return <p style={{ color: "red" }}>{locationError}</p>;

    if (!userLocation) {
      return (
        <div>
          <p>We need your location to show nearby gigs.</p>
          <button onClick={ensureLocationAndComputeNearby}>
            Use my current location
          </button>
        </div>
      );
    }

    if (nearbyGigs.length === 0) {
      return <p>No gigs within {NEARBY_RADIUS_KM} km of your location.</p>;
    }

    return (
      <ul style={{ listStyle: "none", padding: 0 }}>
        {nearbyGigs.map(({ gig, distanceKm }) => (
          <li
            key={gig.id}
            style={{
              border: "1px solid #ddd",
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => openGig(gig, gig.status === "live", distanceKm)}
          >
            <strong>{gig.artistName || "Unknown Artist"}</strong>
            <div>{gig.venueName || "Unknown Venue"}</div>
            <div>Distance: {distanceKm.toFixed(1)} km</div>
            <div>Status: {gig.status}</div>
          </li>
        ))}
      </ul>
    );
  };

  const renderContent = () => {
    if (activeTab === "live") {
      return (
        <>
          <h2>Live Gigs</h2>
          <p>Gigs that are live right now.</p>
          {renderLiveSection()}
        </>
      );
    }

    if (activeTab === "upcoming") {
      return (
        <>
          <h2>Upcoming Gigs</h2>
          <p>Gigs scheduled for later.</p>
          {renderUpcomingSection()}
        </>
      );
    }

    if (activeTab === "nearby") {
      return (
        <>
          <h2>Nearby Gigs</h2>
          <p>Gigs within {NEARBY_RADIUS_KM} km of your location.</p>
          {renderNearbySection()}
        </>
      );
    }

    // "all"
    return (
      <>
        <h2>Live Gigs</h2>
        {renderLiveSection()}

        <h3 style={{ marginTop: 24 }}>Upcoming Gigs</h3>
        {renderUpcomingSection()}
      </>
    );
  };

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ marginBottom: 8 }}>
          ⬅ Back
        </button>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        {["live", "upcoming", "all", "nearby"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              marginRight: 8,
              padding: "6px 12px",
              borderRadius: 4,
              border:
                activeTab === tab ? "1px solid #000" : "1px solid #ccc",
              background: activeTab === tab ? "#000" : "#fff",
              color: activeTab === tab ? "#fff" : "#000",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab === "live" && "Live"}
            {tab === "upcoming" && "Upcoming"}
            {tab === "all" && "All"}
            {tab === "nearby" && "Nearby"}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  );
};

export default DiscoverPage;

