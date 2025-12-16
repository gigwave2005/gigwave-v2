// src/services/playlistService.js
import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

const PLAYLISTS_COLLECTION = "playlists";

export async function getPlaylistsForArtist(artistId) {
  const q = query(
    collection(db, PLAYLISTS_COLLECTION),
    where("artistId", "==", artistId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createPlaylist(artistId, data) {
  const ref = collection(db, PLAYLISTS_COLLECTION);
  const docRef = await addDoc(ref, {
    artistId,
    name: data.name,
    description: data.description || "",
    songs: data.songs || [],
    totalDurationSec: data.totalDurationSec || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePlaylist(playlistId, data) {
  const ref = doc(db, PLAYLISTS_COLLECTION, playlistId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlaylist(playlistId) {
  const ref = doc(db, PLAYLISTS_COLLECTION, playlistId);
  await deleteDoc(ref);
}
