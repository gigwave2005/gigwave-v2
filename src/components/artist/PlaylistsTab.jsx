// src/components/artist/PlaylistsTab.jsx
import React, { useEffect, useState } from "react";
import {
  getPlaylistsForArtist,
  createPlaylist,
  deletePlaylist,
} from "../../services/playlistService";

const PlaylistsTab = ({ artistId }) => {
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const data = await getPlaylistsForArtist(artistId);
      setPlaylists(data);
    } catch (err) {
      console.error("Error loading playlists", err);
      alert("Error loading playlists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [artistId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert("Playlist name is required.");
      return;
    }
    setSaving(true);
    try {
      await createPlaylist(artistId, {
        name: newName.trim(),
        description: newDesc.trim(),
        songs: [],
      });
      setNewName("");
      setNewDesc("");
      await loadPlaylists();
    } catch (err) {
      console.error("Error creating playlist", err);
      alert("Error creating playlist");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this playlist?")) return;
    try {
      await deletePlaylist(id);
      await loadPlaylists();
    } catch (err) {
      console.error("Error deleting playlist", err);
      alert("Error deleting playlist");
    }
  };

  return (
    <div>
      <h2>Playlists / Setlists</h2>

      <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Playlist name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          style={{ marginRight: 8, width: 240 }}
        />
        <button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create Playlist"}
        </button>
      </form>

      {loading ? (
        <p>Loading playlists…</p>
      ) : playlists.length === 0 ? (
        <p>No playlists yet. Create one above.</p>
      ) : (
        <ul>
          {playlists.map((p) => (
            <li key={p.id} style={{ marginBottom: 8 }}>
              <strong>{p.name}</strong>
              {p.description && <span> – {p.description}</span>}
              <button
                onClick={() => handleDelete(p.id)}
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

export default PlaylistsTab;
