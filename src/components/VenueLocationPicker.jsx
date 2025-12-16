// src/components/VenueLocationPicker.jsx
import React, { useEffect, useRef, useState } from "react";

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const VenueLocationPicker = ({ value, onChange }) => {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!GOOGLE_KEY) {
      console.warn("Google Maps API key missing");
      setError("Google Maps API key missing. Ask developer to configure it.");
      return;
    }

    function initAutocomplete() {
      if (!inputRef.current || !window.google?.maps?.places) return;

      const autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["establishment", "geocode"], // venues + addresses
          componentRestrictions: { country: "in" }, // India
        }
      );

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
          setError("No details available for that place.");
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        const loc = {
          address: place.formatted_address || place.name || query,
          city: "",
          country: "",
          location: { lat, lng },
        };

        console.log("Google chosen place:", place, loc);
        setError("");
        setQuery(loc.address);
        onChange && onChange(loc);
      });
    }

    // If already loaded, just init
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    // If script already injected, wait for load
    const existing = document.querySelector('script[data-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", initAutocomplete);
      return;
    }

    // Inject Google Maps JS script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
    script.async = true;
    script.dataset.googleMaps = "true";
    script.onload = initAutocomplete;
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      setError("Failed to load Google Maps. Please try again later.");
    };
    document.body.appendChild(script);
  }, [query]);

  // Fallback: if Google fails, still allow using typed address
  const handleUseTypedAddress = () => {
    if (!query.trim()) {
      setError("Please type an address or venue first.");
      return;
    }

    const loc = {
      address: query.trim(),
      city: "",
      country: "",
      location: null, // no lat/lng if Google didn’t resolve it
    };

    console.log("Using typed address only:", loc);
    setError("");
    onChange && onChange(loc);
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, borderRadius: 6 }}>
      <h4>Venue Location</h4>
      <p style={{ fontSize: 12, marginTop: 0 }}>
        Start typing the venue name or address (Google Places).
      </p>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. Toit Kalyani Nagar, Effingut KP…"
        style={{
          width: "100%",
          padding: 8,
          fontSize: 14,
          boxSizing: "border-box",
        }}
      />

      <button
        type="button"
        onClick={handleUseTypedAddress}
        style={{ marginTop: 8, padding: "6px 10px", fontSize: 13 }}
      >
        Use this typed address
      </button>

      {error && (
        <p style={{ color: "red", fontSize: 12, marginTop: 6 }}>{error}</p>
      )}

      {value?.address && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <strong>Selected:</strong>
          <div>{value.address}</div>
          {value.location && (
            <div>
              Lat: {value.location.lat?.toFixed?.(5)}, Lng:{" "}
              {value.location.lng?.toFixed?.(5)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VenueLocationPicker;
