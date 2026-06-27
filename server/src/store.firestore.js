// Firestore-backed store (production). Same async interface as store.file.js.
//
// Auth: uses Application Default Credentials. Either set
// GOOGLE_APPLICATION_CREDENTIALS to a service-account key file, or run on GCP /
// Firebase where ADC is provided. FIRESTORE_PROJECT_ID pins the project.
//
// Collections:  users/{id}  ·  plans/{userId}  ·  snapshots/{userId}
import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  // Credentials, in priority order:
  //  1) FIREBASE_SERVICE_ACCOUNT = the full service-account JSON as a string
  //     (best for hosts like Render/Railway where you paste a secret).
  //  2) GOOGLE_APPLICATION_CREDENTIALS = path to the downloaded key file (local).
  //  3) Application Default Credentials when running on GCP/Firebase.
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  else credential = applicationDefault();
  initializeApp({ credential, projectId: process.env.FIRESTORE_PROJECT_ID });
}
const db = getFirestore();

export async function upsertUser({ id, email, name, provider }) {
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();
  const createdAt = snap.exists ? snap.data().createdAt : new Date().toISOString();
  const user = { id, email, name, provider, createdAt, lastLogin: new Date().toISOString() };
  await ref.set(user, { merge: true });
  return user;
}
export async function getUser(id) { const s = await db.collection("users").doc(id).get(); return s.exists ? s.data() : null; }
export async function getPlan(userId) {
  const s = await db.collection("plans").doc(userId).get();
  return s.exists ? s.data() : { chosen: [], schedule: {}, completed: [], inProgress: [] };
}
export async function savePlan(userId, plan) {
  const data = { ...plan, updatedAt: new Date().toISOString() };
  await db.collection("plans").doc(userId).set(data, { merge: true });
  return data;
}
export async function getSnapshot(userId) { const s = await db.collection("snapshots").doc(userId).get(); return s.exists ? s.data() : null; }
export async function saveSnapshot(userId, snapshot) {
  const data = { ...snapshot, ingestedAt: new Date().toISOString() };
  await db.collection("snapshots").doc(userId).set(data);
  return data;
}
