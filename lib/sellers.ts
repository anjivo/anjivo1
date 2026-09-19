import {
  addDoc,
  collection,
  serverTimestamp,
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
  const sellerRef = await addDoc(
    collection(db, "sellers"),
    {
      ...application,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return sellerRef.id;
}
