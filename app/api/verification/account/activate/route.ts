
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate the Firebase ID token.
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match?.[1]) {
      return errorResponse("Please log in again.", 401);
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(
        match[1],
        true
      );
    } catch (error) {
      console.error(
        "Account activation token verification failed:",
        error
      );

      return errorResponse(
        "Your session has expired. Please log in again.",
        401
      );
    }

    const uid = decodedToken.uid;

    // 2. Fetch authoritative user information from Firebase Auth.
    const authUser = await adminAuth.getUser(uid);

    if (!authUser.email || authUser.emailVerified !== true) {
      return errorResponse(
        "Please verify your email before activating your account.",
        403
      );
    }

    if (!authUser.phoneNumber) {
      return errorResponse(
        "Please verify your mobile number before activating your account.",
        403
      );
    }

    // 3. Load the existing Firestore profile.
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return errorResponse(
        "Account profile was not found. Please contact support.",
        404
      );
    }

    const profile = userSnap.data();

    if (!profile) {
      return errorResponse(
        "Account profile is invalid. Please contact support.",
        403
      );
    }

    // 4. Permit customer accounts only.
    const role = String(profile.role ?? "")
      .trim()
      .toUpperCase();

    const allowedRoles = [
      "RETAIL_CUSTOMER",
      "WHOLESALE_CUSTOMER",
    ];

    if (!allowedRoles.includes(role)) {
      return errorResponse(
        "This account type cannot be activated through customer verification.",
        403
      );
    }

    // 5. Never reactivate a restricted account.
    const currentStatus = String(
      profile.accountStatus ?? ""
    )
      .trim()
      .toUpperCase();

    const restrictedStatuses = [
      "SUSPENDED",
      "BLOCKED",
      "DISABLED",
      "DEACTIVATED",
    ];

    if (restrictedStatuses.includes(currentStatus)) {
      return errorResponse(
        "This account is restricted. Please contact support.",
        403
      );
    }

    if (
      currentStatus !== "PENDING_VERIFICATION" &&
      currentStatus !== "ACTIVE"
    ) {
      return errorResponse(
        "The account status is invalid. Please contact support.",
        409
      );
    }

    // 6. Synchronize verified details and activate the account.
    // Admin SDK bypasses Firestore client security rules.
    await userRef.set(
      {
        uid,
        email: authUser.email.trim().toLowerCase(),
        phone: authUser.phoneNumber,
        emailVerified: true,
        phoneVerified: true,
        accountStatus: "ACTIVE",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Your ANJIVO account has been activated successfully.",
      accountStatus: "ACTIVE",
      emailVerified: true,
      phoneVerified: true,
    });
  } catch (error) {
    console.error("Account activation failed:", error);

    return errorResponse(
      "Account activation could not be completed. Please try again.",
      500
    );
  }
}
