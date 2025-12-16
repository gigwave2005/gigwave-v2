// src/components/artist/SongsTab.jsx
import React, { useEffect, useState } from "react";
import {
  getSongsForArtist,
  addSongToLibrary,
} from "../../services/songService";

const SongsTab = ({ artistId }) => {
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState([]);
  const [newSong, setNewSong] = useState({ title: "", originalArtist: "" });
  const [saving, setSaving] = useState(false);

  const loadSongs = async () => {
    setLoading(true);
    try {
      const data = await getSongsForArtist(artistId);
      setSongs(data);
    } catch (err) {
      console.error("Error loading songs", err);
      alert("Error loading songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSongs();
  }, [artistId]);

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!newSong.title) {
      alert("Song title is required");
      return;
    }
    setSaving(true);
    try {
      await addSongToLibrary(artistId, {
        title: newSong.title,
        originalArtist: newSong.originalArtist,
      });
      setNewSong({ title: "", originalArtist: "" });
      await loadSongs();
    } catch (err) {
      console.error("Error adding song", err);
      alert("Error adding song");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Song Library</h2>

      <form onSubmit={handleAddSong} style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Song title"
          value={newSong.title}
          onChange={(e) =>
            setNewSong((prev) => ({ ...prev, title: e.target.value }))
          }
          style={{ marginRight: 8 }}
        />
        <input
          type="text"
          placeholder="Original artist"
          value={newSong.originalArtist}
          onChange={(e) =>
            setNewSong((prev) => ({ ...prev, originalArtist: e.target.value }))
          }
          style={{ marginRight: 8 }}
        />
        <button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add Song"}
        </button>
      </form>

      {loading ? (
        <p>Loading songs…</p>
      ) : songs.length === 0 ? (
        <p>No songs yet. Add your first song above.</p>
      ) : (
        <ul>
          {songs.map((s) => (
            <li key={s.id}>
              {s.title} {s.originalArtist && `– ${s.originalArtist}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SongsTab;
