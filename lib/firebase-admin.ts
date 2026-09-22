import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";

import {
  getFirestore,
} from "firebase-admin/firestore";

export function getAdminApp(): App {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  const privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase Admin environment variables are missing."
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey:
        privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminDb =
  getFirestore(getAdminApp());
