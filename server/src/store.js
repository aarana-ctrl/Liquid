// Store facade: selects Firestore when DB=firestore, else the file store.
// Lazily imports the backend so firebase-admin is only required in Firestore mode.
const useFirestore = process.env.DB === "firestore";
let _backend;
async function backend() {
  if (!_backend) _backend = await (useFirestore ? import("./store.firestore.js") : import("./store.file.js"));
  return _backend;
}
export const STORE_KIND = useFirestore ? "firestore" : "file";

export async function upsertUser(u) { return (await backend()).upsertUser(u); }
export async function getUser(id) { return (await backend()).getUser(id); }
export async function getPlan(id) { return (await backend()).getPlan(id); }
export async function savePlan(id, p) { return (await backend()).savePlan(id, p); }
export async function getSnapshot(id) { return (await backend()).getSnapshot(id); }
export async function saveSnapshot(id, s) { return (await backend()).saveSnapshot(id, s); }
