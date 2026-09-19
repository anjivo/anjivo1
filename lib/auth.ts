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

import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";


/* =========================================
   REGISTER CUSTOMER
========================================= */

export async function registerCustomer(
  name: string,
  email: string,
  password: string,
  customerType:
    | "RETAIL_CUSTOMER"
    | "WHOLESALE_CUSTOMER" = "RETAIL_CUSTOMER"
): Promise<User> {
  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  const user = credential.user;

  await updateProfile(user, {
    displayName: name.trim(),
  });

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),

    role: customerType,

    phone: "",
    photoURL: "",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return user;
}


/* =========================================
   LOGIN
========================================= */

export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const credential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  return credential.user;
}


/* =========================================
   LOGOUT
========================================= */

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
