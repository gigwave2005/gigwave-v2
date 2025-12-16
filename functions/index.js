// functions/index.js
// GigWave Cloud Functions (v2 HTTPS + callable only)

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * Health check
 */
exports.helloWorld = onRequest((req, res) => {
  logger.info("GigWave backend OK");
  res.send("GigWave backend is alive ✅");
});

/**
 * Validate artist
 */
async function getGigAsArtist(gigId, auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const gigRef = db.collection("gigs").doc(gigId);
  const gigSnap = await gigRef.get();

  if (!gigSnap.exists) {
    throw new HttpsError("not-found", "Gig not found.");
  }

  const gig = gigSnap.data();

  if (gig.artistId !== auth.uid) {
    throw new HttpsError("permission-denied", "Only the artist can do this.");
  }

  return { gigRef, gig };
}

/**
 * Load request doc
 */
async function getRequestDoc(gigId, requestId) {
  const reqRef = db.collection("gigs").doc(gigId)
    .collection("requests")
    .doc(requestId);

  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Request not found.");
  }

  return { reqRef, req: reqSnap.data() };
}

/**
 * ACCEPT request
 */
exports.acceptRequest = onCall(async (data, context) => {
  const { gigId, requestId } = data;
  const auth = context.auth;

  const { gigRef } = await getGigAsArtist(gigId, auth);
  const { reqRef, req } = await getRequestDoc(gigId, requestId);

  await reqRef.update({
    status: "accepted",
    acceptedAt: FieldValue.serverTimestamp(),
  });

  await gigRef.update({
  acceptedRequestsCount: FieldValue.increment(1),
  nowPlaying: {
    songName: req.songName || "",
    requestId,
    type: "request",
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  },
});


  return { success: true };
});

/**
 * REJECT request
 */
exports.rejectRequest = onCall(async (data, context) => {
  const { gigId, requestId } = data;
  const { gigRef } = await getGigAsArtist(gigId, context.auth);
  const { reqRef } = await getRequestDoc(gigId, requestId);

  await reqRef.update({
    status: "rejected",
    rejectedAt: FieldValue.serverTimestamp(),
  });

  await gigRef.update({
    rejectedRequestsCount: FieldValue.increment(1),
  });

  return { success: true };
});

/**
 * MARK AS PLAYED
 */
exports.markPlayed = onCall(async (data, context) => {
  const { gigId, requestId } = data;
  const auth = context.auth;

  const { gigRef, gig } = await getGigAsArtist(gigId, auth);
  const { reqRef } = await getRequestDoc(gigId, requestId);

  // 1️⃣ Mark request as played
  await reqRef.update({
    status: "played",
    playedAt: FieldValue.serverTimestamp(),
  });

  // 2️⃣ Build gig update
  const gigUpdate = {
    playedRequestsCount: FieldValue.increment(1),
  };

  // 3️⃣ ⭐ CLEAR nowPlaying IF it matches this request
  if (
    gig.nowPlaying &&
    gig.nowPlaying.requestId === requestId
  ) {
    gigUpdate.nowPlaying = FieldValue.delete();
  }

  await gigRef.update(gigUpdate);

  return { success: true };
});

/**
 * SET NOW PLAYING manually
 */
exports.setNowPlaying = onCall(async (data, context) => {
  const { gigId, requestId } = data;
  const { gigRef } = await getGigAsArtist(gigId, context.auth);
  const { req } = await getRequestDoc(gigId, requestId);

  await gigRef.update({
  nowPlaying: {
    songName: req.songName || "",
    requestId,
    type: "request",
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  },
});

  return { success: true };
});

/**
 * SET NOW PLAYING from gig playlist
 */
exports.setNowPlayingFromPlaylist = onCall(async (data, context) => {
  const { gigId, trackIndex } = data;
  const auth = context.auth;

  if (typeof trackIndex !== "number") {
    throw new HttpsError("invalid-argument", "trackIndex is required");
  }

  const { gigRef, gig } = await getGigAsArtist(gigId, auth);

  const playlist =
    Array.isArray(gig.playlist) && gig.playlist.length > 0
      ? gig.playlist
      : [];

  if (!playlist[trackIndex]) {
    throw new HttpsError("not-found", "Track not found in playlist");
  }

  const track = playlist[trackIndex];
  const songName =
    typeof track === "string"
      ? track
      : track.title || track.name || "Untitled track";

  await gigRef.update({
    nowPlaying: {
    songName,
    trackIndex,
    type: "playlist",
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  },
  });

  return { success: true };
});

/**
 * END GIG
 * Marks the gig as ended and clears live state
 */
exports.endGig = onCall(async (data, context) => {
  const { gigId } = data;
  const auth = context.auth;

  if (!gigId) {
    throw new HttpsError("invalid-argument", "gigId is required");
  }

  const { gigRef, gig } = await getGigAsArtist(gigId, auth);

  // Prevent double-ending
  if (gig.status === "ended") {
    throw new HttpsError(
      "failed-precondition",
      "Gig is already ended"
    );
  }

  await gigRef.update({
    status: "ended",
    endedAt: FieldValue.serverTimestamp(),
    nowPlaying: FieldValue.delete(),
  });

  return { success: true };
});

// ⚠️ No scheduled cleanup function — handled on client (Option A)

/**
 * 🔁 GIG LIFECYCLE AUTO-MANAGER
 *
 * Runs every 10 minutes
 * Handles:
 * 1. Upcoming → Check with Venue (30 min after start time)
 * 2. Auto-end live gigs not ended by artist
 * 3. Cancel gigs that never went live
 */
exports.autoManageGigLifecycle = onSchedule(
  { schedule: "every 10 minutes" },
  async () => {
    logger.info("Running gig lifecycle cleanup…");

    const now = new Date();
    const snapshot = await db.collection("gigs").get();
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const gig = doc.data();
      if (!gig.date || !gig.time || !gig.status) return;

      const startTime = new Date(`${gig.date}T${gig.time}:00+05:30`);
      const diffMinutes = (now - startTime) / 60000;

      // RULE 1 — Upcoming → Check with Venue (30 min)
      if (
        gig.status === "upcoming" &&
        diffMinutes >= 30 &&
        diffMinutes < 300
      ) {
        batch.update(doc.ref, {
          status: "Check with Venue",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // RULE 2 — Cancel if never went live (5 hrs)
      if (
        (gig.status === "upcoming" || gig.status === "Check with Venue") &&
        diffMinutes >= 300
      ) {
        batch.update(doc.ref, {
          status: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // RULE 3 — Auto-end live gigs (5 hrs)
      if (gig.status === "live" && diffMinutes >= 300) {
        batch.update(doc.ref, {
          status: "ended",
          endedAt: admin.firestore.FieldValue.serverTimestamp(),
          nowPlaying: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();
    logger.info("Gig lifecycle cleanup complete.");
  }
);

