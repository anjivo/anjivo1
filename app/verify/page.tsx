"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type VerificationStatus = {
  emailVerified: boolean;
  phoneVerified: boolean;
};

export default function VerifyPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");

  const [status, setStatus] =
    useState<VerificationStatus>({
      emailVerified: false,
      phoneVerified: false,
    });

  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }

        try {
          setUserEmail(user.email || "");

          const userRef = doc(
            db,
            "users",
            user.uid
          );

          const userSnap =
            await getDoc(userRef);

          if (userSnap.exists()) {
            const data =
              userSnap.data();

            setUserPhone(
              data.phone || ""
            );

            setStatus({
              emailVerified:
                data.emailVerified === true,

              phoneVerified:
                data.phoneVerified === true,
            });
          }
        } catch (err) {
          console.error(
            "Verification status error:",
            err
          );

          setError(
            "Unable to load verification status."
          );
        } finally {
          setLoading(false);
        }
      });

    return () => unsubscribe();
  }, [router]);

  async function refreshVerificationStatus() {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/login");
      return;
    }

    try {
      setChecking(true);
      setError("");

      await user.reload();

      const refreshedUser =
        auth.currentUser;

      const userRef = doc(
        db,
        "users",
        user.uid
      );

      const userSnap =
        await getDoc(userRef);

      if (userSnap.exists()) {
        const data =
          userSnap.data();

        const emailVerified =
          refreshedUser?.emailVerified === true ||
          data.emailVerified === true;

        const phoneVerified =
          data.phoneVerified === true;

        setStatus({
          emailVerified,
          phoneVerified,
        });

        /*
         * Only move to account when both
         * verification requirements are complete.
         */
        if (
          emailVerified &&
          phoneVerified
        ) {
          await updateDoc(
            userRef,
            {
              accountStatus:
                "ACTIVE",
            }
          );

          router.replace("/account");
        }
      }
    } catch (err) {
      console.error(
        "Refresh verification error:",
        err
      );

      setError(
        "Could not refresh verification status."
      );
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
          <p className="mt-4 text-xs font-semibold text-gray-500">
            Loading verification...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">

      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

          <Link
            href="/"
            className="relative block h-14 w-32"
            aria-label="ANJIVO Home"
          >
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
            onClick={() =>
              router.push("/login")
            }
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
          >
            Login
          </button>

        </div>
      </header>

      {/* MAIN */}
      <main className="px-4 py-8 sm:py-12">

        <div className="mx-auto max-w-lg">

          {/* TITLE */}
          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-2xl text-white">
              🔐
            </div>

            <h1 className="mt-5 text-2xl font-black sm:text-3xl">
              Verify your account
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Complete both verification steps to
              activate your ANJIVO account.
            </p>

          </div>

          {/* ERROR */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* EMAIL */}
          <div className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="flex items-start gap-4">

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                  status.emailVerified
                    ? "bg-green-100"
                    : "bg-gray-100"
                }`}
              >
                {status.emailVerified
                  ? "✓"
                  : "📧"}
              </div>

              <div className="min-w-0 flex-1">

                <div className="flex items-center justify-between gap-3">

                  <h2 className="text-sm font-black">
                    Email Verification
                  </h2>

                  {status.emailVerified ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-[9px] font-black text-green-700">
                      VERIFIED
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[9px] font-black text-yellow-700">
                      PENDING
                    </span>
                  )}

                </div>

                <p className="mt-1 truncate text-xs text-gray-500">
                  {userEmail}
                </p>

                {!status.emailVerified && (
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 py-3 text-xs font-bold text-gray-400"
                  >
                    Email OTP — Coming Next
                  </button>
                )}

                {status.emailVerified && (
                  <p className="mt-3 text-[10px] font-semibold text-green-600">
                    ✓ Email verification completed
                  </p>
                )}

              </div>

            </div>

          </div>

          {/* MOBILE */}
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="flex items-start gap-4">

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                  status.phoneVerified
                    ? "bg-green-100"
                    : "bg-gray-100"
                }`}
              >
                {status.phoneVerified
                  ? "✓"
                  : "📱"}
              </div>

              <div className="min-w-0 flex-1">

                <div className="flex items-center justify-between gap-3">

                  <h2 className="text-sm font-black">
                    Mobile Verification
                  </h2>

                  {status.phoneVerified ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-[9px] font-black text-green-700">
                      VERIFIED
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[9px] font-black text-yellow-700">
                      PENDING
                    </span>
                  )}

                </div>

                <p className="mt-1 text-xs text-gray-500">
                  {userPhone || "Mobile number"}
                </p>

                {!status.phoneVerified && (
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 py-3 text-xs font-bold text-gray-400"
                  >
                    Send Mobile OTP — Coming Next
                  </button>
                )}

                {status.phoneVerified && (
                  <p className="mt-3 text-[10px] font-semibold text-green-600">
                    ✓ Mobile verification completed
                  </p>
                )}

              </div>

            </div>

          </div>

          {/* REFRESH */}
          <button
            type="button"
            onClick={refreshVerificationStatus}
            disabled={checking}
            className="mt-5 w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking
              ? "Checking..."
              : "Refresh Verification Status"}
          </button>

          {/* INFO */}
          <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">

            <p className="text-xs font-black">
              Why do we verify you?
            </p>

            <div className="mt-3 space-y-2 text-[10px] leading-5 text-gray-500">

              <p>
                ✓ Protect your ANJIVO account
              </p>

              <p>
                ✓ Reduce fake accounts and fraud
              </p>

              <p>
                ✓ Secure orders and payments
              </p>

              <p>
                ✓ Enable trusted marketplace features
              </p>

            </div>

          </div>

          {/* LOGOUT */}
          <div className="mt-6 text-center">

            <Link
              href="/"
              className="text-xs font-bold text-gray-500 hover:text-black"
            >
              ← Back to ANJIVO
            </Link>

          </div>

        </div>

      </main>

    </div>
  );
}
