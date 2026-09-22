import {
  getAuth,
} from "firebase-admin/auth";

import {
  getAdminApp,
} from "@/lib/firebase-admin";

export async function verifyIdToken(
  authorizationHeader: string | null
) {
  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "Authentication required."
    );
  }

  const token =
    authorizationHeader
      .slice(7)
      .trim();

  if (!token) {
    throw new Error(
      "Authentication token missing."
    );
  }

  const decodedToken =
    await getAuth(
      getAdminApp()
    ).verifyIdToken(token);

  return decodedToken;
}
