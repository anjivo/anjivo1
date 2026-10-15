
import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { randomInt } from "crypto";

export const runtime = "nodejs";

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SENDGRID_API_KEY?.trim();
    const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();

    if (!apiKey || !fromEmail) {
      console.error("SendGrid environment variables are missing.");
      return jsonError("Email service is not configured.", 500);
    }

    sgMail.setApiKey(apiKey);

    // Require a Firebase ID token; never accept a UID from the request body.
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return jsonError("Please log in again to verify your email.", 401);
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(match[1], true);
    } catch {
      return jsonError("Your session has expired. Please log in again.", 401);
    }

    const user = await adminAuth.getUser(decodedToken.uid);
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return jsonError("No email address is linked to this account.", 400);
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "This email is already verified.",
        alreadyVerified: true,
      });
    }

    const db = adminDb;
    const userRef = db.collection("users").doc(user.uid);
    const otpRef = db.collection("emailVerificationOtps").doc(user.uid);

    const now = Date.now();

    // Check the resend cooldown and update the OTP record transactionally.
    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");

    const result = await db.runTransaction(async (transaction) => {
      const [userSnap, otpSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(otpRef),
      ]);

      if (!userSnap.exists) {
        throw new Error("USER_DOCUMENT_NOT_FOUND");
      }

      const userData = userSnap.data();

      // Prevent sending to a different email than the account's email.
      const storedEmail = String(userData?.email ?? "")
        .trim()
        .toLowerCase();

      if (storedEmail && storedEmail !== email) {
        throw new Error("EMAIL_MISMATCH");
      }

      const previous = otpSnap.exists ? otpSnap.data() : undefined;
      const lastSentAt = previous?.lastSentAt;

      if (
        lastSentAt instanceof Timestamp &&
        now - lastSentAt.toMillis() < RESEND_COOLDOWN_SECONDS * 1000
      ) {
        return { cooldown: true };
      }

      const expiresAt = Timestamp.fromMillis(
        now + OTP_EXPIRY_MINUTES * 60 * 1000
      );

      transaction.set(otpRef, {
        uid: user.uid,
        email,
        otpHash: "", // Filled below only in a follow-up implementation.
        expiresAt,
        lastSentAt: Timestamp.fromMillis(now),
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { cooldown: false, expiresAt };
    });

    if (result.cooldown) {
      return NextResponse.json(
        {
          success: false,
          message: "Please wait 60 seconds before requesting another OTP.",
        },
        { status: 429 }
      );
    }

    // Store only a hash of the OTP, not the plain OTP.
    const { createHash } = await import("crypto");
    const otpHash = createHash("sha256")
      .update(`${user.uid}:${otp}:${process.env.OTP_HASH_SECRET ?? apiKey}`)
      .digest("hex");

    await otpRef.update({ otpHash });

    try {
      await sgMail.send({
        to: email,
        from: fromEmail,
        subject: "Your ANJIVO email verification code",
        text: `Your ANJIVO verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#222">
            <h2>Verify your ANJIVO email</h2>
            <p>Use the following one-time password to verify your account:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">${otp}</div>
            <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
            <p>If you did not request this code, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("SendGrid email delivery failed:", error);

      // Invalidate the OTP if email delivery failed.
      await otpRef.delete().catch(() => undefined);

      return jsonError(
        "Could not send the verification email. Please try again later.",
        502
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification OTP sent to your registered email.",
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_DOCUMENT_NOT_FOUND") {
        return jsonError("Your account profile was not found.", 404);
      }

      if (error.message === "EMAIL_MISMATCH") {
        return jsonError(
          "Your account email does not match. Please contact support.",
          400
        );
      }
    }

    console.error("Email OTP send route error:", error);
    return jsonError("Something went wrong while sending the OTP.", 500);
  }
}
