
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

export const runtime = "nodejs";

const MAX_ADDRESSES = 10;
const ALLOWED_LABELS = ["Home", "Work", "Other"] as const;

type AddressLabel = (typeof ALLOWED_LABELS)[number];

type AddressInput = {
  id?: string;
  label?: AddressLabel;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
};

type CleanAddress = {
  label: AddressLabel;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function authenticate(request: NextRequest) {
  const decodedToken = await verifyIdToken(
    request.headers.get("authorization")
  );

  const uid = decodedToken.uid;

  if (!uid) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const authUser = await adminAuth.getUser(uid);

  if (!authUser.emailVerified || !authUser.phoneNumber) {
    throw new Error("VERIFICATION_REQUIRED");
  }

  const userSnapshot = await adminDb
    .collection("users")
    .doc(uid)
    .get();

  if (!userSnapshot.exists) {
    throw new Error("USER_NOT_FOUND");
  }

  const userData = userSnapshot.data();

  if (
    userData?.accountStatus &&
    userData.accountStatus !== "ACTIVE"
  ) {
    throw new Error("ACCOUNT_INACTIVE");
  }

  return uid;
}

function handleAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "VERIFICATION_REQUIRED") {
    return errorResponse(
      "Verify your email and phone number before managing addresses.",
      403
    );
  }

  if (message === "USER_NOT_FOUND") {
    return errorResponse("User account was not found.", 404);
  }

  if (message === "ACCOUNT_INACTIVE") {
    return errorResponse("Your account is not active.", 403);
  }

  return errorResponse(
    "Authentication failed. Please log in again.",
    401
  );
}

function validateAddress(input: AddressInput): CleanAddress {
  const label = input.label ?? "Home";
  const fullName = stringValue(input.fullName);
  const phone = stringValue(input.phone);
  const addressLine1 = stringValue(input.addressLine1);
  const addressLine2 = stringValue(input.addressLine2);
  const city = stringValue(input.city);
  const state = stringValue(input.state);
  const pincode = stringValue(input.pincode);

  if (!ALLOWED_LABELS.includes(label)) {
    throw new Error("Choose Home, Work, or Other as the address label.");
  }

  if (fullName.length < 2 || fullName.length > 100) {
    throw new Error("Enter a valid full name.");
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new Error("Enter a valid 10-digit mobile number.");
  }

  if (addressLine1.length < 5 || addressLine1.length > 200) {
    throw new Error("Enter a complete delivery address.");
  }

  if (addressLine2.length > 200) {
    throw new Error("Address line 2 is too long.");
  }

  if (city.length < 2 || city.length > 100) {
    throw new Error("Enter a valid city.");
  }

  if (state.length < 2 || state.length > 100) {
    throw new Error("Enter a valid state.");
  }

  if (!/^\d{6}$/.test(pincode)) {
    throw new Error("Enter a valid 6-digit PIN code.");
  }

  return {
    label,
    fullName,
    phone,
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    city,
    state,
    pincode,
    isDefault: input.isDefault === true,
  };
}

function serializeAddress(
  id: string,
  data: FirebaseFirestore.DocumentData
) {
  const toIso = (value: unknown): string | null => {
    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof value.toDate === "function"
    ) {
      return value.toDate().toISOString();
    }

    return null;
  };

  return {
    id,
    label: data.label ?? "Home",
    fullName: data.fullName ?? "",
    phone: data.phone ?? "",
    addressLine1: data.addressLine1 ?? "",
    addressLine2: data.addressLine2 ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    pincode: data.pincode ?? "",
    isDefault: data.isDefault === true,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

/**
 * GET /api/account/addresses
 * Return the authenticated user's saved addresses.
 */
export async function GET(request: NextRequest) {
  try {
    const uid = await authenticate(request);

    const snapshot = await adminDb
      .collection("addresses")
      .doc(uid)
      .collection("items")
      .get();

    const addresses = snapshot.docs
      .map((doc) => serializeAddress(doc.id, doc.data()))
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) {
          return a.isDefault ? -1 : 1;
        }

        return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      });

    return NextResponse.json({
      success: true,
      addresses,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (
      message === "AUTHENTICATION_REQUIRED" ||
      message === "VERIFICATION_REQUIRED" ||
      message === "USER_NOT_FOUND" ||
      message === "ACCOUNT_INACTIVE"
    ) {
      return handleAuthError(error);
    }

    console.error("[ACCOUNT ADDRESSES GET]", error);

    return errorResponse("Could not load saved addresses.", 500);
  }
}

/**
 * POST /api/account/addresses
 * Create a saved address.
 *
 * Body: {
 *   label, fullName, phone, addressLine1, addressLine2,
 *   city, state, pincode, isDefault
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const uid = await authenticate(request);
    const body = (await request.json()) as AddressInput;
    const address = validateAddress(body);

    const collectionRef = adminDb
      .collection("addresses")
      .doc(uid)
      .collection("items");

    const addressRef = collectionRef.doc();

    await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(collectionRef);

      if (existing.size >= MAX_ADDRESSES) {
        throw new Error("ADDRESS_LIMIT_REACHED");
      }

      const shouldBeDefault =
        address.isDefault || existing.empty;

      if (shouldBeDefault) {
        existing.docs.forEach((doc) => {
          transaction.update(doc.ref, {
            isDefault: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      }

      transaction.set(addressRef, {
        ...address,
        isDefault: shouldBeDefault,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const saved = await addressRef.get();

    return NextResponse.json(
      {
        success: true,
        message: "Address saved successfully.",
        address: serializeAddress(addressRef.id, saved.data() ?? {}),
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (
      message === "AUTHENTICATION_REQUIRED" ||
      message === "VERIFICATION_REQUIRED" ||
      message === "USER_NOT_FOUND" ||
      message === "ACCOUNT_INACTIVE"
    ) {
      return handleAuthError(error);
    }

    if (message === "ADDRESS_LIMIT_REACHED") {
      return errorResponse(
        `You can save up to ${MAX_ADDRESSES} addresses.`,
        409
      );
    }

    if (message.startsWith("Enter ") || message.startsWith("Choose ")) {
      return errorResponse(message);
    }

    console.error("[ACCOUNT ADDRESSES POST]", error);

    return errorResponse("Could not save the address.", 500);
  }
}

/**
 * PATCH /api/account/addresses
 * Update a saved address.
 *
 * Body must include the address ID and updated address fields.
 */
export async function PATCH(request: NextRequest) {
  try {
    const uid = await authenticate(request);
    const body = (await request.json()) as AddressInput;

    const id = stringValue(body.id);

    if (!id || id.includes("/")) {
      return errorResponse("A valid address ID is required.");
    }

    const address = validateAddress(body);

    const collectionRef = adminDb
      .collection("addresses")
      .doc(uid)
      .collection("items");

    const addressRef = collectionRef.doc(id);

    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(addressRef);

      if (!current.exists) {
        throw new Error("ADDRESS_NOT_FOUND");
      }

      const existing = await transaction.get(collectionRef);
      const shouldBeDefault = address.isDefault;

      if (shouldBeDefault) {
        existing.docs.forEach((doc) => {
          if (doc.id !== id) {
            transaction.update(doc.ref, {
              isDefault: false,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        });
      } else if (current.data()?.isDefault === true) {
        const replacement = existing.docs.find(
          (doc) => doc.id !== id
        );

        if (replacement) {
          transaction.update(replacement.ref, {
            isDefault: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.update(addressRef, {
        ...address,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const updated = await addressRef.get();

    return NextResponse.json({
      success: true,
      message: "Address updated successfully.",
      address: serializeAddress(id, updated.data() ?? {}),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (
      message === "AUTHENTICATION_REQUIRED" ||
      message === "VERIFICATION_REQUIRED" ||
      message === "USER_NOT_FOUND" ||
      message === "ACCOUNT_INACTIVE"
    ) {
      return handleAuthError(error);
    }

    if (message === "ADDRESS_NOT_FOUND") {
      return errorResponse("Saved address was not found.", 404);
    }

    if (message.startsWith("Enter ") || message.startsWith("Choose ")) {
      return errorResponse(message);
    }

    console.error("[ACCOUNT ADDRESSES PATCH]", error);

    return errorResponse("Could not update the address.", 500);
  }
}

/**
 * DELETE /api/account/addresses?id=<addressId>
 * Delete one saved address belonging to the authenticated user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const uid = await authenticate(request);
    const id = stringValue(
      request.nextUrl.searchParams.get("id")
    );

    if (!id || id.includes("/")) {
      return errorResponse("A valid address ID is required.");
    }

    const collectionRef = adminDb
      .collection("addresses")
      .doc(uid)
      .collection("items");

    const addressRef = collectionRef.doc(id);

    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(addressRef);

      if (!current.exists) {
        throw new Error("ADDRESS_NOT_FOUND");
      }

      const wasDefault = current.data()?.isDefault === true;

      transaction.delete(addressRef);

      if (wasDefault) {
        const remaining = await transaction.get(collectionRef);
        const replacement = remaining.docs.find(
          (doc) => doc.id !== id
        );

        if (replacement) {
          transaction.update(replacement.ref, {
            isDefault: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Address deleted successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (
      message === "AUTHENTICATION_REQUIRED" ||
      message === "VERIFICATION_REQUIRED" ||
      message === "USER_NOT_FOUND" ||
      message === "ACCOUNT_INACTIVE"
    ) {
      return handleAuthError(error);
    }

    if (message === "ADDRESS_NOT_FOUND") {
      return errorResponse("Saved address was not found.", 404);
    }

    console.error("[ACCOUNT ADDRESSES DELETE]", error);

    return errorResponse("Could not delete the address.", 500);
  }
}
