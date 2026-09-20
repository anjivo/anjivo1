import {
  ConfirmationResult,
  RecaptchaVerifier,
  linkWithPhoneNumber,
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

  if (typeof window === "undefined") {
    throw new Error(
      "Phone verification is only available in the browser."
    );
  }

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
   FORMAT INDIAN MOBILE
========================================================= */

function formatPhoneNumber(
  phoneNumber: string
): string {

  let phone =
    phoneNumber
      .trim()
      .replace(/\s+/g, "");

  if (/^\d{10}$/.test(phone)) {
    phone = `+91${phone}`;
  }

  if (/^91\d{10}$/.test(phone)) {
    phone = `+${phone}`;
  }

  if (
    !/^\+[1-9]\d{7,14}$/.test(phone)
  ) {
    throw new Error(
      "Please enter a valid mobile number."
    );
  }

  return phone;
}


/* =========================================================
   SEND MOBILE OTP
========================================================= */

export async function sendMobileOTP(
  phoneNumber: string,
  containerId: string
): Promise<void> {

  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "Please login before verifying your mobile number."
    );
  }

  const cleanPhone =
    formatPhoneNumber(
      phoneNumber
    );

  if (user.phoneNumber === cleanPhone) {
    throw new Error(
      "This mobile number is already verified."
    );
  }

  const verifier =
    initializeRecaptcha(
      containerId
    );

  try {

    confirmationResult =
      await linkWithPhoneNumber(
        user,
        cleanPhone,
        verifier
      );

  } catch (error) {

    console.error(
      "Send mobile OTP error:",
      error
    );

    confirmationResult = null;

    throw new Error(
      "OTP send nahi ho saka. Please try again."
    );
  }
}


/* =========================================================
   VERIFY MOBILE OTP
========================================================= */

export async function verifyMobileOTP(
  otp: string
): Promise<void> {

  if (!auth.currentUser) {
    throw new Error(
      "Please login before verifying your mobile number."
    );
  }

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

  try {

    await confirmationResult.confirm(
      cleanOTP
    );

    confirmationResult = null;

  } catch (error) {

    console.error(
      "Verify mobile OTP error:",
      error
    );

    throw new Error(
      "Invalid OTP. Please check the OTP and try again."
    );
  }
}


/* =========================================================
   PHONE VERIFICATION STATUS
========================================================= */

export function isPhoneVerified(): boolean {

  return Boolean(
    auth.currentUser?.phoneNumber
  );
}


/* =========================================================
   GET VERIFIED PHONE
========================================================= */

export function getVerifiedPhone():
  | string
  | null {

  return (
    auth.currentUser?.phoneNumber
    ?? null
  );
}


/* =========================================================
   RESET
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
