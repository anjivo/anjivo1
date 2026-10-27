import {
  type ConfirmationResult,
  RecaptchaVerifier,
  linkWithPhoneNumber,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;
let verifierContainerId: string | null = null;

/** Return the Firebase error code without exposing tokens or credentials. */
function getFirebaseErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return "unknown";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* =========================================================
   FORMAT PHONE NUMBER
========================================================= */

function formatPhoneNumber(phoneNumber: string): string {
  const input = phoneNumber.trim().replace(/[\s()-]/g, "");
  let phone = input;

  if (/^\d{10}$/.test(phone)) {
    phone = `+91${phone}`;
  } else if (/^91\d{10}$/.test(phone)) {
    phone = `+${phone}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error(
      "Please enter a valid mobile number with country code, e.g. +919876543210."
    );
  }

  return phone;
}

/* =========================================================
   RESET RECAPTCHA
========================================================= */

export function resetPhoneRecaptcha(): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (error) {
      console.warn("Could not clear phone reCAPTCHA verifier:", error);
    }
  }

  recaptchaVerifier = null;
  verifierContainerId = null;
  confirmationResult = null;
}

/* =========================================================
   INITIALIZE RECAPTCHA
========================================================= */

export function initializeRecaptcha(containerId: string): RecaptchaVerifier {
  if (typeof window === "undefined") {
    throw new Error("Phone verification is only available in the browser.");
  }

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(
      `Phone verification container #${containerId} was not found on the page.`
    );
  }

  // Reuse the verifier only when it belongs to this exact container.
  if (recaptchaVerifier && verifierContainerId === containerId) {
    return recaptchaVerifier;
  }

  // A verifier cannot safely be reused with a different DOM container.
  resetPhoneRecaptcha();

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {
      // Firebase continues the SMS request after successful reCAPTCHA.
    },
    "expired-callback": () => {
      confirmationResult = null;
      console.warn("Phone reCAPTCHA expired. Request a new OTP.");
    },
  });

  verifierContainerId = containerId;
  return recaptchaVerifier;
}

/* =========================================================
   SEND MOBILE OTP
========================================================= */

export async function sendMobileOTP(
  phoneNumber: string,
  containerId: string
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in before verifying your mobile number.");
  }

  const cleanPhone = formatPhoneNumber(phoneNumber);

  if (user.phoneNumber === cleanPhone) {
    throw new Error("This mobile number is already linked to your account.");
  }

  // Clear a previous confirmation before beginning a fresh SMS request.
  confirmationResult = null;

  let verifier: RecaptchaVerifier;
  try {
    verifier = initializeRecaptcha(containerId);
    await verifier.render();

    confirmationResult = await linkWithPhoneNumber(
      user,
      cleanPhone,
      verifier
    );
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    const message = getErrorMessage(error);

    // Log diagnostic details, but never log OTPs, ID tokens, or API secrets.
    console.error("Send mobile OTP failed:", {
      code,
      message,
      hostname: typeof window !== "undefined" ? window.location.hostname : null,
      authDomain: auth.app.options.authDomain ?? null,
      projectId: auth.app.options.projectId ?? null,
    });

    confirmationResult = null;

    // Clear the verifier after failure so the next attempt creates a fresh one.
    resetPhoneRecaptcha();

    if (code === "auth/captcha-check-failed" || code === "auth/invalid-app-credential") {
      throw new Error(
        "Firebase reCAPTCHA verification failed. Confirm that this website hostname is listed in Firebase Authentication → Settings → Authorized domains, and that this app uses the correct Firebase project. Then refresh and try again."
      );
    }

    if (code === "auth/invalid-phone-number") {
      throw new Error("The mobile number is invalid. Include the country code, e.g. +919876543210.");
    }

    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait before requesting another OTP.");
    }

    if (code === "auth/quota-exceeded") {
      throw new Error("Firebase SMS quota has been exceeded. Try again later.");
    }

    if (code === "auth/credential-already-in-use") {
      throw new Error("This mobile number is already linked to another account.");
    }

    throw new Error(`Could not send mobile OTP (${code}): ${message}`);
  }
}

/* =========================================================
   VERIFY MOBILE OTP
========================================================= */

export async function verifyMobileOTP(otp: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error("Please log in before verifying your mobile number.");
  }

  if (!confirmationResult) {
    throw new Error("Please request a new mobile OTP first.");
  }

  const cleanOTP = otp.trim();
  if (!/^\d{6}$/.test(cleanOTP)) {
    throw new Error("Please enter the 6-digit OTP.");
  }

  try {
    await confirmationResult.confirm(cleanOTP);
    confirmationResult = null;
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    console.error("Verify mobile OTP failed:", {
      code,
      message: getErrorMessage(error),
    });

    if (code === "auth/code-expired") {
      throw new Error("This OTP has expired. Request a new OTP.");
    }

    if (code === "auth/invalid-verification-code") {
      throw new Error("The OTP is incorrect. Please check it and try again.");
    }

    throw new Error(`Could not verify mobile OTP (${code}): ${getErrorMessage(error)}`);
  }
}

/* =========================================================
   PHONE VERIFICATION STATUS
========================================================= */

export function isPhoneVerified(): boolean {
  return Boolean(auth.currentUser?.phoneNumber);
}

/* =========================================================
   GET VERIFIED PHONE
========================================================= */

export function getVerifiedPhone(): string | null {
  return auth.currentUser?.phoneNumber ?? null;
}
