
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return errorResponse("Please log in again.", 401);
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(match[1], true);
    } catch {
      return errorResponse(
        "Your session has expired. Please log in again.",
        401
      );
    }

    const body = await request.json().catch(() => null);
    const otp =
      typeof body?.otp === "string" ? body.otp.trim() : "";

    if (!/^\d{6}$/.test(otp)) {
      return errorResponse("Enter a valid 6-digit OTP.", 400);
    }

    const uid = decodedToken.uid;
    const user = await adminAuth.getUser(uid);
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return errorResponse(
        "No email is linked to this account.",
        400
      );
    }

    const db = adminDb;
    const otpRef = db.collection("emailVerificationOtps").doc(uid);
    const userRef = db.collection("users").doc(uid);

    // If Firebase Auth already confirms the email, sync Firestore.
    if (user.emailVerified) {
      const profile = await userRef.get();

      if (!profile.exists) {
        return errorResponse("Account profile was not found.", 404);
      }

      await userRef.set(
        {
          emailVerified: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        message: "Email is already verified.",
        alreadyVerified: true,
      });
    }

    const secret = process.env.OTP_HASH_SECRET;

    if (!secret) {
      console.error("OTP_HASH_SECRET is missing.");
      return errorResponse(
        "Email verification is not configured.",
        500
      );
    }

    const result = await db.runTransaction(async (transaction) => {
      const otpSnap = await transaction.get(otpRef);
      const userSnap = await transaction.get(userRef);

      if (!otpSnap.exists) {
        return {
          ok: false as const,
          message: "OTP not found. Request a new code.",
        };
      }

      if (!userSnap.exists) {
        return {
          ok: false as const,
          message: "Account profile was not found.",
        };
      }

      const record = otpSnap.data()!;
      const storedEmail = String(record.email ?? "")
        .trim()
        .toLowerCase();

      if (record.uid !== uid || storedEmail !== email) {
        transaction.delete(otpRef);

        return {
          ok: false as const,
          message: "OTP is invalid. Request a new code.",
        };
      }

      const expiresAt = record.expiresAt;

      if (
        !(expiresAt instanceof Timestamp) ||
        expiresAt.toMillis() <= Date.now()
      ) {
        transaction.delete(otpRef);

        return {
          ok: false as const,
          message: "OTP expired. Request a new code.",
        };
      }

      const attempts = Number(record.attempts ?? 0);

      if (attempts >= 5) {
        transaction.delete(otpRef);

        return {
          ok: false as const,
          message: "Too many attempts. Request a new code.",
        };
      }

      const expectedHash = createHash("sha256")
        .update(`${uid}:${otp}:${secret}`)
        .digest("hex");

      const storedHash = String(record.otpHash ?? "");

      const hashesMatch =
        /^[a-f0-9]{64}$/i.test(storedHash) &&
        timingSafeEqual(
          Buffer.from(expectedHash, "hex"),
          Buffer.from(storedHash, "hex")
        );

      if (!hashesMatch) {
        transaction.update(otpRef, {
          attempts: attempts + 1,
        });

        return {
          ok: false as const,
          message: "Incorrect OTP. Please try again.",
        };
      }

      // Consume the OTP only after successful validation.
      transaction.delete(otpRef);

      return { ok: true as const };
    });

    if (!result.ok) {
      const status =
        result.message.includes("Too many") ? 429 :
        result.message.includes("not found") ? 404 : 400;

      return errorResponse(result.message, status);
    }

    // Update Firebase Authentication's authoritative email status.
    try {
      await adminAuth.updateUser(uid, {
        emailVerified: true,
      });
    } catch (error) {
      console.error("Firebase Auth email verification update failed:", error);

      return errorResponse(
        "OTP was accepted, but verification could not be completed. Please try again or contact support.",
        500
      );
    }

    // Update the profile without activating the account.
    await userRef.set(
      {
        emailVerified: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Email verified successfully.",
      emailVerified: true,
      phoneVerificationRequired: true,
    });
  } catch (error) {
    console.error("Email OTP verification error:", error);

    return errorResponse(
      "Something went wrong while verifying the OTP.",
      500
    );
  }
}
