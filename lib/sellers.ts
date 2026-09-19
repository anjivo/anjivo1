import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type SellerApplication = {
  userId: string;

  businessName: string;
  ownerName: string;
  phone: string;
  email: string;

  businessType:
    | "INDIVIDUAL"
    | "PROPRIETORSHIP"
    | "PARTNERSHIP"
    | "LLP"
    | "PRIVATE_LIMITED";

  category: string;

  address: string;
  city: string;
  state: string;
  pincode: string;

  gstNumber?: string;
  panNumber?: string;

  bankAccountName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;

  status: "pending";
};

export async function createSellerApplication(
  application: SellerApplication
): Promise<string> {
  if (!application.userId) {
    throw new Error(
      "User ID is required."
    );
  }

  // IMPORTANT:
  // Seller document ID = Firebase Auth UID
  const sellerRef = doc(
    db,
    "sellers",
    application.userId
  );

  await setDoc(sellerRef, {
    ...application,

    userId: application.userId,

    status: "pending",

    sellerVerified: false,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  });

  return sellerRef.id;
}
