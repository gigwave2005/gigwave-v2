// src/services/artistService.js
import { db } from "../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const ARTISTS_COLLECTION = "artists";

export async function getArtistProfile(artistId) {
  const ref = doc(db, ARTISTS_COLLECTION, artistId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function saveArtistProfile(artistId, profileData) {
  const ref = doc(db, ARTISTS_COLLECTION, artistId);
  await setDoc(
    ref,
    {
      ...profileData,
      userId: artistId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
