
import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let firebaseAdminApp: App | undefined;

export function getAdminApp(): App {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  const existingApp = getApps().find(
    (app) => app.name === "admin"
  );

  if (existingApp) {
    firebaseAdminApp = existingApp;
    return firebaseAdminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are missing. Check server environment variables."
    );
  }

  firebaseAdminApp = initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    "admin"
  );

  return firebaseAdminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

// Backward-compatible exports.
// These initialize only when accessed at runtime.
export const adminAuth = new Proxy(
  {} as ReturnType<typeof getAuth>,
  {
    get(_target, property) {
      const auth = getAdminAuth();
      const value = Reflect.get(auth, property, auth);

      return typeof value === "function"
        ? value.bind(auth)
        : value;
    },
  }
);

export const adminDb = new Proxy(
  {} as ReturnType<typeof getFirestore>,
  {
    get(_target, property) {
      const db = getAdminDb();
      const value = Reflect.get(db, property, db);

      return typeof value === "function"
        ? value.bind(db)
        : value;
    }
  }
);
