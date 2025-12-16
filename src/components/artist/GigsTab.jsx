// src/components/artist/GigsTab.jsx
import React, { useEffect, useState } from "react";
import {
  getGigsForArtist,
  createGig,
  deleteGig,
} from "../../services/gigService"; // your planned gigs service, adapt path if diff
import VenueLocationPicker from "../VenueLocationPicker";

const GigsTab = ({ artistId }) => {
  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState([]);
  const [form, setForm] = useState({
    venueName: "",
    date: "",
    time: "",
  });
  const [venueName, setVenueName] = useState("");
  const [venueLocation, setVenueLocation] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadGigs = async () => {
    setLoading(true);
    try {
      const data = await getGigsForArtist(artistId);
      setGigs(data);
    } catch (err) {
      console.error("Error loading gigs", err);
      alert("Error loading gigs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGigs();
  }, [artistId]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.venueName || !form.date || !form.time) {
      alert("Venue name, date, and time are required.");
      return;
    }

    if (!venueLocation?.location) {
      alert("Please set a venue location (search or use your location).");
      return;
    }

    setSaving(true);
    try {
      await createGig({
        artistId,
        artistName: "", // later: pull from artist profile
        venueName: form.venueName,
        address: venueLocation.address,
        city: venueLocation.city,
        country: venueLocation.country,
        location: venueLocation.location, // { lat, lng }
        date: form.date,
        time: form.time,
        timezone: "Asia/Kolkata",
        status: "upcoming",
        queueSize: 20,
      });
      setForm({ venueName: "", date: "", time: "" });
      setVenueLocation(null);
      await loadGigs();
    } catch (err) {
      console.error("Error creating gig", err);
      alert("Error creating gig");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (gigId) => {
    if (!window.confirm("Delete this gig?")) return;
    try {
      await deleteGig(gigId);
      await loadGigs();
    } catch (err) {
      console.error("Error deleting gig", err);
      alert("Error deleting gig");
    }
  };

  return (
    <div>
      <h2>Gigs</h2>

      <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Venue name"
          value={form.venueName}
          onChange={handleChange("venueName")}
          style={{ marginRight: 8 }}
        />
        <input
          type="date"
          value={form.date}
          onChange={handleChange("date")}
          style={{ marginRight: 8 }}
        />
        <input
          type="time"
          value={form.time}
          onChange={handleChange("time")}
          style={{ marginRight: 8 }}
        />
        <button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create Gig"}
        </button>
      </form>

      <VenueLocationPicker value={venueLocation} onChange={setVenueLocation} />

      <hr style={{ margin: "16px 0" }} />

      {loading ? (
        <p>Loading gigs…</p>
      ) : gigs.length === 0 ? (
        <p>No gigs yet. Create one above.</p>
      ) : (
        <ul>
          {gigs.map((g) => (
            <li key={g.id} style={{ marginBottom: 8 }}>
              <strong>{g.venueName}</strong> – {g.city} – {g.date} {g.time} (
              {g.status})
              {g.location && (
                <span>
                  {" "}
                  • [ {g.location.lat.toFixed(3)}, {g.location.lng.toFixed(3)} ]
                </span>
              )}
              <button
                onClick={() => handleDelete(g.id)}
                style={{ marginLeft: 8 }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GigsTab;
