// src/components/artist/ProfileTab.jsx
import React, { useEffect, useState } from "react";
import { getArtistProfile, saveArtistProfile } from "../../services/artistService";
import { auth } from "../../config/firebase";

const ProfileTab = ({ artistId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    artistName: "",
    fullName: "",
    bio: "",
    genre: "",
    city: "",
    country: "",
    instagram: "",
    facebook: "",
    youtube: "",
    spotify: "",
    website: "",
  });

  const currentUser = auth.currentUser;

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const existing = await getArtistProfile(artistId);
        if (existing && isMounted) {
          setProfile((prev) => ({
            ...prev,
            ...existing,
            instagram: existing.social?.instagram || "",
            facebook: existing.social?.facebook || "",
            youtube: existing.social?.youtube || "",
            spotify: existing.social?.spotify || "",
            website: existing.social?.website || "",
          }));
        }
      } catch (err) {
        console.error("Error loading artist profile", err);
        alert("Error loading artist profile");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [artistId]);

  const handleChange = (field) => (e) => {
    setProfile((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!profile.artistName || !profile.fullName || profile.bio.length < 20) {
      alert("Artist name, full name and a bio (min 20 chars) are required.");
      return;
    }

    setSaving(true);
    try {
      await saveArtistProfile(artistId, {
        artistName: profile.artistName,
        fullName: profile.fullName,
        bio: profile.bio,
        genre: profile.genre,
        city: profile.city,
        country: profile.country,
        emailVerified: currentUser?.emailVerified ?? false,
        social: {
          instagram: profile.instagram || null,
          facebook: profile.facebook || null,
          youtube: profile.youtube || null,
          spotify: profile.spotify || null,
          website: profile.website || null,
        },
      });

      alert("Profile saved.");
    } catch (err) {
      console.error("Error saving artist profile", err);
      alert("Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading profile…</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Artist Profile</h2>

      <div style={{ marginTop: 8 }}>
        <label>
          Artist Name
          <input
            type="text"
            value={profile.artistName}
            onChange={handleChange("artistName")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Your Full Name
          <input
            type="text"
            value={profile.fullName}
            onChange={handleChange("fullName")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Bio
          <textarea
            value={profile.bio}
            onChange={handleChange("bio")}
            rows={4}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Genre
          <input
            type="text"
            value={profile.genre}
            onChange={handleChange("genre")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          City
          <input
            type="text"
            value={profile.city}
            onChange={handleChange("city")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Country
          <input
            type="text"
            value={profile.country}
            onChange={handleChange("country")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <h3>Social Links</h3>

        <label>
          Instagram
          <input
            type="text"
            value={profile.instagram}
            onChange={handleChange("instagram")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Facebook
          <input
            type="text"
            value={profile.facebook}
            onChange={handleChange("facebook")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          YouTube
          <input
            type="text"
            value={profile.youtube}
            onChange={handleChange("youtube")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Spotify
          <input
            type="text"
            value={profile.spotify}
            onChange={handleChange("spotify")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <label>
          Website
          <input
            type="text"
            value={profile.website}
            onChange={handleChange("website")}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
        </label>

        <button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </div>
  );
};

export default ProfileTab;
