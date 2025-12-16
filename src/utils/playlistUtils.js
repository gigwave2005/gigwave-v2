// src/utils/playlistUtils.js

// Normalize different track shapes into a standard object
export function normalizeTrack(track) {
  if (!track) return null;

  if (typeof track === "string") {
    return {
      itunesId: null,
      title: track,
      artistName: null,
    };
  }

  if (typeof track === "object") {
    return {
      itunesId: track.itunesId || track.trackId || track.id || null,
      title:
        track.title ||
        track.name ||
        track.trackName ||
        "Untitled track",
      artistName:
        track.artistName ||
        track.artist ||
        track.singer ||
        null,
      ...track,
    };
  }

  return null;
}

// Clamp songLimit to a safe range
export function clampSongLimit(rawLimit) {
  let limit =
    typeof rawLimit === "number" && !Number.isNaN(rawLimit)
      ? rawLimit
      : 20;
  if (limit < 5) limit = 5;
  if (limit > 60) limit = 60;
  return limit;
}

// Deduplication key (DO NOT include __source)
function getTrackKey(track) {
  if (track.itunesId) return `itunes:${track.itunesId}`;
  const t = (track.title || "").toLowerCase().trim();
  const a = (track.artistName || "").toLowerCase().trim();
  return `${t}::${a}`;
}

// Compute the effective playlist for a gig
export function computeEffectivePlaylist(gig) {
  const songLimit = clampSongLimit(gig?.songLimit);

  const gigTracksRaw = Array.isArray(gig?.playlist)
    ? gig.playlist
    : [];
  const masterTracksRaw = Array.isArray(gig?.masterTracks)
    ? gig.masterTracks
    : [];

  const seen = new Set();
  const result = [];

  // 1️⃣ Add gig playlist tracks first
  for (const raw of gigTracksRaw) {
    if (result.length >= songLimit) break;

    const track = normalizeTrack(raw);
    if (!track) continue;

    const key = getTrackKey(track);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({
      ...track,
      __source: "gig",
    });
  }

  // 2️⃣ Supplement from master playlist if needed
  if (result.length < songLimit) {
    for (const raw of masterTracksRaw) {
      if (result.length >= songLimit) break;

      const track = normalizeTrack(raw);
      if (!track) continue;

      const key = getTrackKey(track);
      if (seen.has(key)) continue;

      seen.add(key);
      result.push({
        ...track,
        __source: "master",
      });
    }
  }

  return result;
}
