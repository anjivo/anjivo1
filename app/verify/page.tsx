 "use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  type User,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import FloatingHelpButton from "@/components/support/FloatingHelpButton";

type VerificationStatus = {
  emailVerified: boolean;
  phoneVerified: boolean;
};

function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  // Default to India for a 10-digit number or 91 + 10-digit number.
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;

  throw new Error("Enter a valid phone number with country code, e.g. +919876543210.");
}

function firebaseErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  switch (code) {
    case "auth/invalid-phone-number":
      return "Phone number is invalid. Use a number with country code, e.g. +919876543210.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again later.";
    case "auth/quota-exceeded":
      return "SMS quota has been exceeded. Please try again later.";
    case "auth/captcha-check-failed":
      return "Firebase rejected the reCAPTCHA hostname. Check that this exact website domain is authorized in Firebase Authentication and that the Vercel Firebase environment variables belong to the same Firebase project.";
    case "auth/invalid-app-credential":
      return "Firebase rejected the phone verification credential. Check the Firebase project/API key configuration and authorized domains, then refresh and try again.";
    case "auth/app-not-authorized":
      return "This website is not authorized for Firebase phone authentication. Add the current hostname in Firebase Authentication > Settings > Authorized domains.";
    case "auth/credential-already-in-use":
      return "This phone number is already linked to another ANJIVO account.";
    case "auth/provider-already-linked":
      return "A phone number is already linked to this account. Contact support if it is incorrect.";
    case "auth/code-expired":
      return "OTP expired. Please request a new code.";
    case "auth/invalid-verification-code":
      return "Incorrect OTP. Please check the code and try again.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}

export default function VerifyPage() {
  const router = useRouter();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [sendingPhone, setSendingPhone] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<VerificationStatus>({
    emailVerified: false,
    phoneVerified: false,
  });

  const loadStatus = useCallback(async (user: User) => {
    setUserEmail(user.email || "");
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const data = userSnap.exists() ? userSnap.data() : {};
    // Verification status must come from Firebase Authentication, not editable
    // Firestore flags. Firestore values are used only to display the saved phone.
    const next = {
      emailVerified: user.emailVerified === true,
      phoneVerified: Boolean(user.phoneNumber),
    };

    const savedPhone =
      typeof data.phone === "string" && data.phone.trim()
        ? data.phone.trim()
        : user.phoneNumber || "";

    setUserPhone(savedPhone);
    setPhoneInput(savedPhone);
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        await loadStatus(user);
      } catch (e) {
        console.error("Verification status load failed:", e);
        setError("Unable to load verification status. Please refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [loadStatus, router]);

  async function getToken() {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");
    return user.getIdToken(true);
  }

  async function sendEmailOtp() {
    setSendingEmail(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/verification/email/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.error || "Could not send OTP.");
      }
      setEmailOtpSent(true);
      setMessage(result.message || "OTP sent. Check your inbox and spam folder.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send OTP.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function activateAccountIfVerified(user: User): Promise<boolean> {
    await user.reload();
    const freshUser = auth.currentUser;
    if (!freshUser) {
      router.replace("/login");
      return false;
    }

    const emailVerified = freshUser.emailVerified === true;
    const phoneVerified = Boolean(freshUser.phoneNumber);

    setStatus({ emailVerified, phoneVerified });

    if (!emailVerified || !phoneVerified) {
      return false;
    }

    const token = await freshUser.getIdToken(true);
    const response = await fetch("/api/verification/account/activate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message ||
          "Both checks passed, but account activation could not be completed. Please try again."
      );
    }

    router.replace("/account");
    return true;
  }

  async function verifyEmailOtp() {
    setVerifyingEmail(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/verification/email/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp: emailOtp }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.error || "Could not verify OTP.");
      }

      setEmailOtp("");
      setEmailOtpSent(false);
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        const next = await loadStatus(auth.currentUser || user);
        setMessage(result.message || "Email verified successfully.");
        if (next.emailVerified && next.phoneVerified) {
          await activateAccountIfVerified(auth.currentUser || user);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify OTP.");
    } finally {
      setVerifyingEmail(false);
    }
  }

  function getRecaptchaVerifier() {
    if (typeof window === "undefined") {
      throw new Error("Phone verification can only run in the browser.");
    }

    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          // Firebase proceeds with the SMS request after reCAPTCHA succeeds.
        },
        "expired-callback": () => {
          setError("reCAPTCHA expired. Please send the OTP again.");
        },
      });
    }

    return recaptchaRef.current;
  }

  async function sendPhoneOtp() {
    setSendingPhone(true);
    setError("");
    setMessage("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again.");
      if (user.phoneNumber) {
        const next = await loadStatus(user);
        if (next.phoneVerified) {
          setMessage("This mobile number is already verified.");
          return;
        }
      }

      const normalizedPhone = normalizePhoneNumber(phoneInput);
      const verifier = getRecaptchaVerifier();
      await verifier.render();

      // Link phone to the existing email/password account rather than creating a second account.
      confirmationRef.current = await linkWithPhoneNumber(
        user,
        normalizedPhone,
        verifier
      );

      setPhoneInput(normalizedPhone);
      setPhoneOtpSent(true);
      setPhoneOtp("");
      setMessage(`OTP sent to ${normalizedPhone}.`);
    } catch (e) {
      const firebaseCode =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code?: unknown }).code ?? "unknown")
          : "unknown";
      const firebaseMessage = e instanceof Error ? e.message : String(e);

      // Log diagnostics without exposing API keys, tokens, or OTP values.
      console.error("Send mobile OTP failed:", {
        code: firebaseCode,
        message: firebaseMessage,
        hostname: typeof window !== "undefined" ? window.location.hostname : "server",
        firebaseProjectId: auth.app.options.projectId ?? "missing",
        firebaseAuthDomain: auth.app.options.authDomain ?? "missing",
      });

      confirmationRef.current = null;
      try {
        recaptchaRef.current?.clear();
      } catch (clearError) {
        console.warn("Could not clear reCAPTCHA verifier:", clearError);
      }
      recaptchaRef.current = null;
      setError(firebaseErrorMessage(e));
    } finally {
      setSendingPhone(false);
    }
  }

  async function verifyPhoneOtp() {
    setVerifyingPhone(true);
    setError("");
    setMessage("");

    try {
      const confirmation = confirmationRef.current;
      if (!confirmation) {
        throw new Error("Request a mobile OTP first.");
      }
      if (!/^\d{6}$/.test(phoneOtp)) {
        throw new Error("Enter the 6-digit OTP.");
      }

      const credentialResult = await confirmation.confirm(phoneOtp);
      const verifiedUser = credentialResult.user;
      await verifiedUser.reload();
      const currentUser = auth.currentUser || verifiedUser;
      const verifiedPhone = currentUser.phoneNumber;

      if (!verifiedPhone) {
        throw new Error("Firebase did not return a verified phone number. Please try again.");
      }

      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error("Account profile was not found. Please contact support.");
      }

      // Do not activate an account from the browser. The account activation
      // decision must be made by a trusted server after checking both factors.
      const emailVerified = currentUser.emailVerified === true;

      await updateDoc(userRef, {
        phone: verifiedPhone,
        updatedAt: serverTimestamp(),
      });

      confirmationRef.current = null;
      setPhoneOtp("");
      setPhoneOtpSent(false);
      setUserPhone(verifiedPhone);
      setPhoneInput(verifiedPhone);
      setStatus({ emailVerified, phoneVerified: true });
      setMessage("Mobile number verified successfully.");

      if (emailVerified) {
        await activateAccountIfVerified(auth.currentUser || currentUser);
      }
    } catch (e) {
      console.error("Verify mobile OTP failed:", e);
      setError(firebaseErrorMessage(e));
    } finally {
      setVerifyingPhone(false);
    }
  }

  async function refreshStatus() {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/login");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await user.reload();
      const next = await loadStatus(auth.currentUser || user);
      if (next.emailVerified && next.phoneVerified) {
        await activateAccountIfVerified(auth.currentUser || user);
      } else {
        setMessage("Verification status refreshed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh status.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
          <p className="mt-4 text-xs font-semibold text-gray-500">Loading verification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <FloatingHelpButton />
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="relative block h-14 w-32" aria-label="ANJIVO Home">
            <Image
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              fill
              priority
              sizes="128px"
              className="object-contain object-left"
            />
          </Link>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
          >
            Login
          </button>
        </div>
      </header>

      <main className="px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-lg">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-2xl text-white">🔐</div>
            <h1 className="mt-5 text-2xl font-black sm:text-3xl">Verify your account</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Verify your email and mobile number to activate your ANJIVO account.
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold leading-5 text-green-700">
              {message}
            </div>
          )}

          <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${status.emailVerified ? "bg-green-100" : "bg-gray-100"}`}>
                {status.emailVerified ? "✓" : "📧"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black">Email Verification</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${status.emailVerified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {status.emailVerified ? "VERIFIED" : "PENDING"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">{userEmail}</p>
                {!status.emailVerified ? (
                  <div className="mt-4 space-y-3">
                    {!emailOtpSent ? (
                      <button
                        type="button"
                        onClick={sendEmailOtp}
                        disabled={sendingEmail}
                        className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {sendingEmail ? "Sending OTP..." : "Send Email OTP"}
                      </button>
                    ) : (
                      <>
                        <label htmlFor="email-otp" className="block text-xs font-semibold text-gray-700">Enter 6-digit email OTP</label>
                        <input
                          id="email-otp"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={verifyEmailOtp}
                          disabled={verifyingEmail || emailOtp.length !== 6}
                          className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {verifyingEmail ? "Verifying..." : "Verify Email OTP"}
                        </button>
                        <button
                          type="button"
                          onClick={sendEmailOtp}
                          disabled={sendingEmail}
                          className="w-full rounded-xl border border-gray-200 py-3 text-xs font-bold hover:border-black disabled:opacity-50"
                        >
                          {sendingEmail ? "Sending..." : "Resend Email OTP"}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] font-semibold text-green-600">✓ Email verification completed</p>
                )}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${status.phoneVerified ? "bg-green-100" : "bg-gray-100"}`}>
                {status.phoneVerified ? "✓" : "📱"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black">Mobile Verification</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${status.phoneVerified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {status.phoneVerified ? "VERIFIED" : "PENDING"}
                  </span>
                </div>

                {!status.phoneVerified ? (
                  <div className="mt-4 space-y-3">
                    <label htmlFor="phone-number" className="block text-xs font-semibold text-gray-700">
                      Mobile number (India number can be 10 digits)
                    </label>
                    <input
                      id="phone-number"
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      autoComplete="tel"
                      placeholder="+919876543210"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                    />
                    {!phoneOtpSent ? (
                      <button
                        type="button"
                        onClick={sendPhoneOtp}
                        disabled={sendingPhone || !phoneInput.trim()}
                        className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {sendingPhone ? "Sending SMS OTP..." : "Send Mobile OTP"}
                      </button>
                    ) : (
                      <>
                        <p className="text-xs leading-5 text-gray-500">
                          Enter the 6-digit code sent to {phoneInput}.
                        </p>
                        <label htmlFor="phone-otp" className="block text-xs font-semibold text-gray-700">Enter mobile OTP</label>
                        <input
                          id="phone-otp"
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={verifyPhoneOtp}
                          disabled={verifyingPhone || phoneOtp.length !== 6}
                          className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {verifyingPhone ? "Verifying..." : "Verify Mobile OTP"}
                        </button>
                        <button
                          type="button"
                          onClick={sendPhoneOtp}
                          disabled={sendingPhone}
                          className="w-full rounded-xl border border-gray-200 py-3 text-xs font-bold hover:border-black disabled:opacity-50"
                        >
                          {sendingPhone ? "Sending..." : "Resend Mobile OTP"}
                        </button>
                      </>
                    )}
                    <div id="recaptcha-container" />
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-gray-500">{userPhone || auth.currentUser?.phoneNumber}</p>
                    <p className="mt-3 text-[10px] font-semibold text-green-600">✓ Mobile verification completed</p>
                  </>
                )}
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={refreshStatus}
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Checking..." : "Refresh Verification Status"}
          </button>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-black">Why do we verify you?</p>
            <div className="mt-3 space-y-2 text-[10px] leading-5 text-gray-500">
              <p>✓ Protect your ANJIVO account</p>
              <p>✓ Reduce fake accounts and fraud</p>
              <p>✓ Secure orders and payments</p>
              <p>✓ Enable trusted marketplace features</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs font-bold text-gray-500 hover:text-black">← Back to ANJIVO</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
