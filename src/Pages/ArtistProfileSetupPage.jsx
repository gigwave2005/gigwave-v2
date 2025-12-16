// src/Pages/ArtistProfileSetupPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, auth, storage } from "../config/firebase";

/**
 * Unified Artist Profile Setup Page
 *
 * - Loads existing /artists/{uid} doc (if any) and pre-fills fields
 * - Required: profile picture, stageName
 * - On save writes fields and sets `profileCompleted: true`
 * - Redirects to /artist/dashboard after save
 *
 * NOTE: This keeps your previous field names (stageName, city, genres, bio, photoUrl)
 * and also stores optional fields: website, contactPhone, social (object).
 */
const ArtistProfileSetupPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Primary fields (existing)
  const [stageName, setStageName] = useState("");
  const [city, setCity] = useState("");
  const [genres, setGenres] = useState("");
  const [bio, setBio] = useState("");

  // Optional contact/social fields
  const [website, setWebsite] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [youtube, setYoutube] = useState("");

  // Photo handling
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState(null); // keep reference so user can re-upload before saving

  const [error, setError] = useState("");

  // Load existing artist doc
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const user = auth.currentUser;

      if (!user) {
        navigate("/signin", {
          state: { redirectTo: "/artist/profile-setup", mode: "artist" },
        });
        return;
      }

      try {
        const docRef = doc(db, "artists", user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          if (!mounted) return;

          setStageName(data.stageName || "");
          setCity(data.city || "");
          setGenres(Array.isArray(data.genres) ? data.genres.join(", ") : data.genres || "");
          setBio(data.bio || "");
          setWebsite(data.website || "");
          setContactPhone(data.contactPhone || "");
          setInstagram((data.social && data.social.instagram) || "");
          setFacebook((data.social && data.social.facebook) || "");
          setYoutube((data.social && data.social.youtube) || "");

          if (data.photoUrl) {
            setPhotoUrl(data.photoUrl);
            setPhotoPreview(data.photoUrl);
          }
        }
      } catch (err) {
        console.error("Error loading artist profile:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Handle file selection + upload immediately (same behaviour as earlier)
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const user = auth.currentUser;
    if (!user) {
      setError("You must be signed in to upload a photo.");
      return;
    }

    // Show local preview immediately
    try {
      const localUrl = URL.createObjectURL(file);
      setPhotoPreview(localUrl);
      setPhotoFile(file);

      // Upload to storage (overwrite existing profile.jpg)
      const storageRef = ref(storage, `artists/${user.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      setPhotoUrl(downloadUrl);
      // Clear the file ref (we keep preview + url)
      setPhotoFile(null);
    } catch (err) {
      console.error("Error uploading photo:", err);
      setError("Could not upload photo. Please try again.");
      setPhotoFile(null);
    }
  };

  // Allow removing the uploaded photo (client-side + attempt to remove from storage)
  const handleRemovePhoto = async () => {
    const user = auth.currentUser;
    if (!user) {
      setPhotoUrl("");
      setPhotoPreview("");
      setPhotoFile(null);
      return;
    }

    try {
      // attempt to delete storage object; ignore errors
      const storageRef = ref(storage, `artists/${user.uid}/profile.jpg`);
      await deleteObject(storageRef).catch(() => {});
    } catch (err) {
      // ignore
    } finally {
      setPhotoUrl("");
      setPhotoPreview("");
      setPhotoFile(null);
    }
  };

  const validateUrl = (u) => {
    if (!u) return "";
    try {
      // allow relative / simple strings by returning as-is when URL() fails
      new URL(u);
      return u;
    } catch {
      // try to auto-prefix http:// if user omitted
      try {
        const pref = `https://${u}`;
        new URL(pref);
        return pref;
      } catch {
        // invalid URL — return empty to indicate invalid
        return "";
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const user = auth.currentUser;
    if (!user) {
      navigate("/signin", {
        state: { redirectTo: "/artist/profile-setup", mode: "artist" },
      });
      return;
    }

    // Basic validation
    if (!photoUrl) {
      setError("Please upload a profile picture to continue.");
      return;
    }

    if (!stageName.trim()) {
      setError("Please enter your stage/artist name.");
      return;
    }

    // optional: validate website url
    const normalizedWebsite = website ? validateUrl(website.trim()) : "";
    if (website && !normalizedWebsite) {
      setError("Website URL looks invalid. Try removing spaces or include domain (example.com).");
      return;
    }

    try {
      setSaving(true);

      const artistRef = doc(db, "artists", user.uid);

      const socialObj = {};
      if (instagram.trim()) socialObj.instagram = instagram.trim();
      if (facebook.trim()) socialObj.facebook = facebook.trim();
      if (youtube.trim()) socialObj.youtube = youtube.trim();

      // convert genres to array (trimmed)
      const genresArray = genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);

      await setDoc(
        artistRef,
        {
          uid: user.uid,
          stageName: stageName.trim(),
          city: city.trim(),
          genres: genresArray.length > 0 ? genresArray : [],
          bio: bio.trim(),
          photoUrl: photoUrl || "",
          website: normalizedWebsite || "",
          contactPhone: contactPhone.trim() || "",
          social: Object.keys(socialObj).length > 0 ? socialObj : {},
          profileCompleted: true, // important for gating / redirects
          updatedAt: serverTimestamp(),
          // createdAt only set if not present
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Redirect artist to dashboard (consistent with earlier change)
      navigate("/artist/dashboard");
    } catch (err) {
      console.error("Error saving artist profile:", err);
      setError("Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        Loading profile…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#06000D,#170022,#270036)",
        padding: 16,
        color: "white",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            textShadow: "0 0 10px rgba(255,0,200,0.8)",
          }}
        >
          Artist Profile
        </h2>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            opacity: 0.75,
          }}
        >
          Set up your stage identity so audiences can discover you.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          borderRadius: 20,
          padding: 18,
          background: "rgba(10,0,25,0.9)",
          border: "1px solid rgba(255,0,200,0.35)",
          boxShadow:
            "0 0 16px rgba(255,0,200,0.5), inset 0 0 10px rgba(255,0,200,0.18)",
        }}
      >
        {error && (
          <div
            style={{
              marginBottom: 10,
              padding: 8,
              borderRadius: 8,
              fontSize: 12,
              background: "rgba(255,60,90,0.18)",
              border: "1px solid rgba(255,80,120,0.7)",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ width: 120, textAlign: "center" }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                overflow: "hidden",
                border: photoUrl ? "2px solid rgba(0,255,140,0.9)" : "2px dashed rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
                margin: "0 auto",
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Artist avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (stageName || "A").slice(0, 2).toUpperCase()
              )}
            </div>

            <div style={{ marginTop: 8 }}>
              <label
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {photoUrl ? (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={saving}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "transparent",
                    color: "white",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
                Required
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
                Stage / Artist Name
              </label>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(9,0,25,0.9)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                }}
                maxLength={80}
                placeholder="e.g. The Midnight Waves"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.28)",
                    background: "rgba(9,0,25,0.9)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                  placeholder="e.g. Mumbai"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
                  Number / Contact phone (optional)
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.28)",
                    background: "rgba(9,0,25,0.9)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
                Genres (comma-separated)
              </label>
              <input
                type="text"
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(9,0,25,0.9)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                }}
                placeholder="e.g. Rock, Indie, Pop"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
                Website (optional)
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(9,0,25,0.9)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                }}
                placeholder="yourband.com or https://yourband.com"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, opacity: 0.9 }}>
                Short bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.28)",
                  background: "rgba(9,0,25,0.9)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                }}
                placeholder="Tell your audience what kind of vibe your gigs have."
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, opacity: 0.85 }}>
                  Instagram
                </label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(9,0,25,0.9)",
                    color: "white",
                    fontSize: 13,
                    outline: "none",
                  }}
                  placeholder="@yourhandle"
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, opacity: 0.85 }}>
                  Facebook
                </label>
                <input
                  type="text"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(9,0,25,0.9)",
                    color: "white",
                    fontSize: 13,
                    outline: "none",
                  }}
                  placeholder="facebook.com/yourpage"
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, opacity: 0.85 }}>
                  YouTube
                </label>
                <input
                  type="text"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(9,0,25,0.9)",
                    color: "white",
                    fontSize: 13,
                    outline: "none",
                  }}
                  placeholder="youtube.com/channel/..."
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1,
              width: "100%",
              padding: 12,
              borderRadius: 999,
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: saving ? "default" : "pointer",
              background: saving
                ? "rgba(150,150,150,0.7)"
                : "linear-gradient(90deg,#ff00d4,#8800ff)",
              boxShadow: saving ? "none" : "0 0 16px rgba(255,0,200,0.9)",
              color: "white",
            }}
          >
            {saving ? "Saving…" : "Save & Continue"}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: 12,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "white",
              fontSize: 14,
            }}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default ArtistProfileSetupPage;
