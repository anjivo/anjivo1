import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

/* =========================================================
   REGISTER CUSTOMER
========================================================= */

export async function registerCustomer(
  name: string,
  email: string,
  password: string,
  customerType:
    | "RETAIL_CUSTOMER"
    | "WHOLESALE_CUSTOMER" = "RETAIL_CUSTOMER"
): Promise<User> {
  const cleanName =
    name.trim();

  const cleanEmail =
    email.trim().toLowerCase();

  if (!cleanName) {
    throw new Error(
      "Name is required."
    );
  }

  if (!cleanEmail) {
    throw new Error(
      "Email is required."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "Password must be at least 6 characters."
    );
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user =
    credential.user;

  /*
   * Firebase Auth profile
   */

  await updateProfile(
    user,
    {
      displayName:
        cleanName,
    }
  );

  /*
   * Firestore user profile
   */

  await setDoc(
    doc(
      db,
      "users",
      user.uid
    ),
    {
      uid: user.uid,

      name:
        cleanName,

      email:
        cleanEmail,

      role:
        customerType,

      phone: "",

      photoURL: "",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return user;
}

/* =========================================================
   LOGIN USER
========================================================= */

export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const cleanEmail =
    email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error(
      "Email is required."
    );
  }

  if (!password) {
    throw new Error(
      "Password is required."
    );
  }

  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  return credential.user;
}

/* =========================================================
   LOGOUT USER
========================================================= */

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
