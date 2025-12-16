// src/services/gigService.js

import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
} from "firebase/firestore";

import { db } from "../config/firebase";

const LIVE_GIGS_COLLECTION = "liveGigs";

// Create a simple demo live gig
export async function createDemoLiveGig() {
  try {
    const docRef = await addDoc(collection(db, LIVE_GIGS_COLLECTION), {
      artistName: "Demo Artist",
      venueName: "Demo Venue",
      status: "live",
      createdAt: serverTimestamp(),
    });

    return { id: docRef.id };
  } catch (error) {
    console.error("Error creating demo gig:", error);
    throw error;
  }
}

// Listen to live gigs
export function listenToLiveGigs(callback) {
  const q = query(
    collection(db, LIVE_GIGS_COLLECTION),
    where("status", "==", "live"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const gigs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(gigs);
  });
}

// Subscribe to a single gig document by ID
export function listenToGig(gigId, callback) {
  if (!gigId) {
    callback(null);
    return () => {};
  }

  const gigRef = doc(db, LIVE_GIGS_COLLECTION, gigId);

  const unsubscribe = onSnapshot(
    gigRef,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback({ id: snap.id, ...snap.data() });
      }
    },
    (error) => {
      console.error("Error listening to gig:", error);
      callback(null);
    }
  );

  return unsubscribe;
}
