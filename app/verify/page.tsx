"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type VerificationStatus = { emailVerified: boolean; phoneVerified: boolean };

export default function VerifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
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
    const next = {
      emailVerified: user.emailVerified || data.emailVerified === true,
      phoneVerified: data.phoneVerified === true,
    };
    setUserPhone(typeof data.phone === "string" ? data.phone : "");
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
    return () => unsubscribe();
  }, [loadStatus, router]);

  async function getToken() {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again.");
    return user.getIdToken(true);
  }

  async function sendEmailOtp() {
    setSending(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/verification/email/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send OTP.");
      setOtpSent(true);
      setMessage(result.message || "OTP sent. Check your inbox and spam folder.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send OTP.");
    } finally {
      setSending(false);
    }
  }

  async function verifyEmailOtp() {
    setVerifying(true);
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
        body: JSON.stringify({ otp }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not verify OTP.");
      setOtp("");
      setOtpSent(false);
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        const next = await loadStatus(auth.currentUser || user);
        setMessage(result.message || "Email verified successfully.");
        if (next.emailVerified && next.phoneVerified) {
          router.replace("/account");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify OTP.");
    } finally {
      setVerifying(false);
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
    try {
      await user.reload();
      const next = await loadStatus(auth.currentUser || user);
      if (next.emailVerified && next.phoneVerified) {
        router.replace("/account");
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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="relative block h-14 w-32" aria-label="ANJIVO Home">
            <Image src="/logo/anjivo-logo.png" alt="ANJIVO" fill priority sizes="128px" className="object-contain object-left" />
          </Link>
          <button type="button" onClick={() => router.push("/login")} className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black">Login</button>
        </div>
      </header>

      <main className="px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-lg">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-2xl text-white">🔐</div>
            <h1 className="mt-5 text-2xl font-black sm:text-3xl">Verify your account</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">Verify your email and mobile number to activate your ANJIVO account.</p>
          </div>

          {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">⚠️ {error}</div>}
          {message && <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold leading-5 text-green-700">{message}</div>}

          <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${status.emailVerified ? "bg-green-100" : "bg-gray-100"}`}>{status.emailVerified ? "✓" : "📧"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black">Email Verification</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${status.emailVerified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{status.emailVerified ? "VERIFIED" : "PENDING"}</span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">{userEmail}</p>
                {!status.emailVerified ? (
                  <div className="mt-4 space-y-3">
                    {!otpSent ? (
                      <button type="button" onClick={sendEmailOtp} disabled={sending} className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50">{sending ? "Sending OTP..." : "Send Email OTP"}</button>
                    ) : (
                      <>
                        <label htmlFor="email-otp" className="block text-xs font-semibold text-gray-700">Enter 6-digit OTP</label>
                        <input id="email-otp" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-black" />
                        <button type="button" onClick={verifyEmailOtp} disabled={verifying || otp.length !== 6} className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50">{verifying ? "Verifying..." : "Verify Email OTP"}</button>
                        <button type="button" onClick={sendEmailOtp} disabled={sending} className="w-full rounded-xl border border-gray-200 py-3 text-xs font-bold hover:border-black disabled:opacity-50">{sending ? "Sending..." : "Resend OTP"}</button>
                      </>
                    )}
                  </div>
                ) : <p className="mt-3 text-[10px] font-semibold text-green-600">✓ Email verification completed</p>}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${status.phoneVerified ? "bg-green-100" : "bg-gray-100"}`}>{status.phoneVerified ? "✓" : "📱"}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black">Mobile Verification</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${status.phoneVerified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{status.phoneVerified ? "VERIFIED" : "PENDING"}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{userPhone || "Mobile number"}</p>
                {!status.phoneVerified && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">Mobile OTP integration is not included in this update yet. Email OTP can be completed here; the account remains pending until mobile verification is implemented.</p>}
                {status.phoneVerified && <p className="mt-3 text-[10px] font-semibold text-green-600">✓ Mobile verification completed</p>}
              </div>
            </div>
          </section>

          <button type="button" onClick={refreshStatus} disabled={busy} className="mt-5 w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Checking..." : "Refresh Verification Status"}</button>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-black">Why do we verify you?</p>
            <div className="mt-3 space-y-2 text-[10px] leading-5 text-gray-500">
              <p>✓ Protect your ANJIVO account</p>
              <p>✓ Reduce fake accounts and fraud</p>
              <p>✓ Secure orders and payments</p>
              <p>✓ Enable trusted marketplace features</p>
            </div>
          </div>

          <div className="mt-6 text-center"><Link href="/" className="text-xs font-bold text-gray-500 hover:text-black">← Back to ANJIVO</Link></div>
        </div>
      </main>
    </div>
  );
}
