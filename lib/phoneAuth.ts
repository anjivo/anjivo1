import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

let recaptchaVerifier:
  | RecaptchaVerifier
  | null = null;

let confirmationResult:
  | ConfirmationResult
  | null = null;

/* =========================================================
   INITIALIZE RECAPTCHA
========================================================= */

export function initializeRecaptcha(
  containerId: string
): RecaptchaVerifier {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier =
    new RecaptchaVerifier(
      auth,
      containerId,
      {
        size: "invisible",
      }
    );

  return recaptchaVerifier;
}

/* =========================================================
   SEND MOBILE OTP
========================================================= */

export async function sendMobileOTP(
  phoneNumber: string,
  containerId: string
): Promise<void> {
  const cleanPhone =
    phoneNumber.trim();

  if (!cleanPhone) {
    throw new Error(
      "Mobile number is required."
    );
  }

  const verifier =
    initializeRecaptcha(containerId);

  confirmationResult =
    await signInWithPhoneNumber(
      auth,
      cleanPhone,
      verifier
    );
}

/* =========================================================
   VERIFY MOBILE OTP
========================================================= */

export async function verifyMobileOTP(
  otp: string
): Promise<void> {
  if (!confirmationResult) {
    throw new Error(
      "Please request an OTP first."
    );
  }

  const cleanOTP =
    otp.trim();

  if (!/^\d{6}$/.test(cleanOTP)) {
    throw new Error(
      "Please enter a valid 6-digit OTP."
    );
  }

  await confirmationResult.confirm(
    cleanOTP
  );

  confirmationResult = null;
}

/* =========================================================
   RESET RECAPTCHA
========================================================= */

export function resetPhoneRecaptcha(): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Ignore cleanup errors.
    }

    recaptchaVerifier = null;
  }

  confirmationResult = null;
}
