// src/services/plannedGigService.js
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

const GIGS_COLLECTION = "gigs";

// Create an upcoming gig (for testing)
export async function createDemoUpcomingGig() {
  const ref = collection(db, GIGS_COLLECTION);
  await addDoc(ref, {
    artistName: "Demo Artist",
    venueName: "Demo Upcoming Venue",
    city: "Demo City",
    status: "upcoming",
    date: "2025-12-31", // string YYYY-MM-DD for now
    time: "20:00",
    createdAt: serverTimestamp(),
  });
}

// Get upcoming gigs (basic version: status === "upcoming")
export async function getUpcomingGigs() {
  const q = query(
    collection(db, GIGS_COLLECTION),
    where("status", "==", "upcoming"),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
