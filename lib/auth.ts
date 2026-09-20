import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  reload,
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
   TYPES
========================================================= */

export type CustomerType =
  | "RETAIL_CUSTOMER"
  | "WHOLESALE_CUSTOMER";

export type CustomerRegistrationData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  customerType: CustomerType;
};


/* =========================================================
   REGISTER CUSTOMER
========================================================= */

export async function registerCustomer(
  data: CustomerRegistrationData
): Promise<User> {

  const cleanName =
    data.name.trim();

  const cleanEmail =
    data.email
      .trim()
      .toLowerCase();

  const cleanPhone =
    data.phone.trim();


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

  if (!cleanPhone) {
    throw new Error(
      "Mobile number is required."
    );
  }

  if (data.password.length < 6) {
    throw new Error(
      "Password must be at least 6 characters."
    );
  }


  /*
   * Create Firebase Auth account
   */

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      data.password
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
   *
   * Verification fields remain false.
   */

  await setDoc(
    doc(
      db,
      "users",
      user.uid
    ),
    {
      uid: user.uid,

      name: cleanName,

      email: cleanEmail,

      phone: cleanPhone,

      role: data.customerType,

      customerType:
        data.customerType,

      emailVerified: false,

      phoneVerified: false,

      accountStatus:
        "PENDING_VERIFICATION",

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
   SEND EMAIL VERIFICATION
========================================================= */

export async function sendUserEmailVerification(): Promise<void> {

  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Please login before verifying your email."
    );
  }

  /*
   * If Firebase already considers the
   * email verified, no new email is required.
   */

  if (user.emailVerified) {
    return;
  }

  try {

    await sendEmailVerification(
      user
    );

  } catch (error) {

    console.error(
      "Email verification error:",
      error
    );

    throw new Error(
      "Verification email send nahi ho saka. Please try again."
    );
  }
}


/* =========================================================
   CHECK / REFRESH EMAIL VERIFICATION
========================================================= */

export async function refreshEmailVerificationStatus(): Promise<boolean> {

  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Please login first."
    );
  }

  /*
   * Refresh Firebase Auth user data.
   *
   * This is important because the user may have
   * opened the verification link in another tab
   * or another device/browser.
   */

  await reload(user);

  /*
   * auth.currentUser can be refreshed after reload.
   */

  return Boolean(
    auth.currentUser?.emailVerified
  );
}


/* =========================================================
   IS EMAIL VERIFIED
========================================================= */

export function isEmailVerified(): boolean {

  return Boolean(
    auth.currentUser?.emailVerified
  );
}


/* =========================================================
   GET CURRENT USER
========================================================= */

export function getCurrentUser():
  | User
  | null {

  return auth.currentUser;
}


/* =========================================================
   LOGIN USER
========================================================= */

export async function loginUser(
  email: string,
  password: string
): Promise<User> {

  const cleanEmail =
    email
      .trim()
      .toLowerCase();

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
