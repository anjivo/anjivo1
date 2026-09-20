import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/* =========================================================
   SELLER BUSINESS TYPES
========================================================= */

export type SellerBusinessType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "LLP"
  | "PRIVATE_LIMITED";

/* =========================================================
   SELLER APPLICATION
========================================================= */

export type SellerApplication = {
  userId: string;

  businessName: string;
  ownerName: string;

  phone: string;
  email: string;

  businessType: SellerBusinessType;

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
};

/* =========================================================
   CREATE SELLER APPLICATION
========================================================= */

export async function createSellerApplication(
  application: SellerApplication
): Promise<string> {
  /* -----------------------------------------
     BASIC VALIDATION
  ----------------------------------------- */

  if (!application.userId) {
    throw new Error("User ID is required.");
  }

  if (!application.businessName.trim()) {
    throw new Error("Business name is required.");
  }

  if (!application.ownerName.trim()) {
    throw new Error("Owner name is required.");
  }

  if (!application.phone.trim()) {
    throw new Error("Phone number is required.");
  }

  if (!application.email.trim()) {
    throw new Error("Email address is required.");
  }

  if (!application.businessType) {
    throw new Error("Business type is required.");
  }

  if (!application.category.trim()) {
    throw new Error("Business category is required.");
  }

  if (!application.address.trim()) {
    throw new Error("Business address is required.");
  }

  if (!application.city.trim()) {
    throw new Error("City is required.");
  }

  if (!application.state.trim()) {
    throw new Error("State is required.");
  }

  if (!/^\d{6}$/.test(application.pincode)) {
    throw new Error(
      "Please enter a valid 6-digit pincode."
    );
  }

  /* -----------------------------------------
     CLEAN DATA
  ----------------------------------------- */

  const userId = application.userId.trim();

  const cleanData = {
    userId,

    businessName:
      application.businessName.trim(),

    ownerName:
      application.ownerName.trim(),

    phone:
      application.phone.trim(),

    email:
      application.email.trim().toLowerCase(),

    businessType:
      application.businessType,

    category:
      application.category.trim(),

    address:
      application.address.trim(),

    city:
      application.city.trim(),

    state:
      application.state.trim(),

    pincode:
      application.pincode.trim(),

    gstNumber:
      application.gstNumber?.trim().toUpperCase() || "",

    panNumber:
      application.panNumber?.trim().toUpperCase() || "",

    bankAccountName:
      application.bankAccountName?.trim() || "",

    bankAccountNumber:
      application.bankAccountNumber?.trim() || "",

    ifscCode:
      application.ifscCode
        ?.trim()
        .toUpperCase() || "",
  };

  /* -----------------------------------------
     SELLER DOCUMENT
     
     Document ID = Firebase Auth UID
  ----------------------------------------- */

  const sellerRef = doc(
    db,
    "sellers",
    userId
  );

  /* -----------------------------------------
     IMPORTANT

     Status / verification fields are created
     by the system.

     Seller registration cannot select:
     approved
     verified
     active
     rejected
  ----------------------------------------- */

  await setDoc(sellerRef, {
    ...cleanData,

    status: "pending",

    sellerVerified: false,

    emailVerified: false,

    phoneVerified: false,

    gstVerified: false,

    panVerified: false,

    bankVerified: false,

    adminApproved: false,

    accountStatus: "PENDING",

    createdAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
  });

  return sellerRef.id;
}
