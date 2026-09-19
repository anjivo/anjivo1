"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  loginUser,
} from "@/lib/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  auth,
  db,
} from "@/lib/firebase";

type LoginType = "BUYER" | "SELLER";

export default function LoginPage() {
  const router = useRouter();

  const [loginType, setLoginType] =
    useState<LoginType>("BUYER");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [resettingPassword, setResettingPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError(
        "Please enter your email address."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your password."
      );
      return;
    }

    try {
      setLoading(true);

      const user =
        await loginUser(
          email,
          password
        );

      /*
       * Get the ANJIVO user profile
       * from Firestore.
       */

      const userRef = doc(
        db,
        "users",
        user.uid
      );

      const userSnapshot =
        await getDoc(userRef);

      if (!userSnapshot.exists()) {
        setError(
          "Your ANJIVO profile could not be found. Please contact support."
        );
        return;
      }

      const userData =
        userSnapshot.data();

      const role =
        String(
          userData.role ?? ""
        );

      const sellerStatus =
        String(
          userData.sellerStatus ?? ""
        );

      /*
       * =========================
       * SELLER LOGIN
       * =========================
       */

      if (loginType === "SELLER") {

        if (role !== "SELLER") {
          setError(
            "This account is a Buyer account. To sell on ANJIVO, please apply as a Seller."
          );
          return;
        }

        if (
          sellerStatus === "pending"
        ) {
          router.push(
            "/seller/application"
          );
          return;
        }

        if (
          sellerStatus === "rejected"
        ) {
          setError(
            "Your Seller application was rejected. Please contact ANJIVO support."
          );
          return;
        }

        if (
          sellerStatus === "approved"
        ) {
          router.push(
            "/seller"
          );
          return;
        }

        router.push(
          "/seller"
        );

        return;
      }

      /*
       * =========================
       * BUYER LOGIN
       * =========================
       */

      if (
        role === "RETAIL_CUSTOMER" ||
        role === "WHOLESALE_CUSTOMER"
      ) {
        router.push(
          "/account"
        );
        return;
      }

      if (role === "SELLER") {
        router.push(
          "/seller"
        );
        return;
      }

      if (role === "ADMIN") {
        router.push(
          "/admin"
        );
        return;
      }

      setError(
        "Your ANJIVO account role could not be identified."
      );

    } catch (err: unknown) {
      console.error(
        "Login error:",
        err
      );

      if (
        err &&
        typeof err === "object" &&
        "code" in err
      ) {
        const code =
          String(
            (
              err as {
                code?: string;
              }
            ).code
          );

        if (
          code ===
            "auth/invalid-credential" ||
          code ===
            "auth/wrong-password" ||
          code ===
            "auth/user-not-found"
        ) {
          setError(
            "Email or password is incorrect."
          );
        } else if (
          code ===
          "auth/invalid-email"
        ) {
          setError(
            "Please enter a valid email address."
          );
        } else if (
          code ===
          "auth/too-many-requests"
        ) {
          setError(
            "Too many login attempts. Please try again later."
          );
        } else {
          setError(
            "Login failed. Please try again."
          );
        }
      } else {
        setError(
          "Login failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }


  /* =========================================
     FORGOT PASSWORD
  ========================================= */

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError(
        "Enter your email address first, then click Forgot Password."
      );
      return;
    }

    try {
      setResettingPassword(true);

      await sendPasswordResetEmail(
        auth,
        email.trim()
      );

      setSuccess(
        "Password reset email has been sent. Please check your inbox."
      );

    } catch (err: unknown) {
      console.error(
        "Password reset error:",
        err
      );

      if (
        err &&
        typeof err === "object" &&
        "code" in err
      ) {
        const code =
          String(
            (
              err as {
                code?: string;
              }
            ).code
          );

        if (
          code ===
          "auth/user-not-found"
        ) {
          setError(
            "No ANJIVO account was found with this email."
          );
        } else if (
          code ===
          "auth/invalid-email"
        ) {
          setError(
            "Please enter a valid email address."
          );
        } else {
          setError(
            "Could not send password reset email. Please try again."
          );
        }
      } else {
        setError(
          "Could not send password reset email. Please try again."
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }


  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">

      {/* =========================================
          HEADER
      ========================================= */}

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

          <Link
            href="/register"
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:border-black"
          >
            Create Account
          </Link>

        </div>

      </header>


      {/* =========================================
          MAIN
      ========================================= */}

      <main className="px-4 py-8 sm:py-12">

        <div className="mx-auto max-w-lg">

          {/* =====================================
              TITLE
          ===================================== */}

          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-2xl">
              👋
            </div>

            <h1 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
              Welcome to ANJIVO
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Choose how you use ANJIVO before signing in.
            </p>

          </div>


          {/* =====================================
              BUYER / SELLER SELECTOR
          ===================================== */}

          <div className="mt-7 grid grid-cols-2 gap-3">

            {/* BUYER */}

            <button
              type="button"
              onClick={() => {
                setLoginType("BUYER");
                setError("");
                setSuccess("");
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                loginType === "BUYER"
                  ? "border-black bg-black text-white shadow-lg"
                  : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
              }`}
            >

              <div className="text-2xl">
                🛒
              </div>

              <p className="mt-3 text-sm font-black">
                I want to Buy
              </p>

              <p
                className={`mt-1 text-[10px] leading-4 ${
                  loginType === "BUYER"
                    ? "text-gray-300"
                    : "text-gray-500"
                }`}
              >
                Shop products or buy
                in wholesale quantities.
              </p>

            </button>


            {/* SELLER */}

            <button
              type="button"
              onClick={() => {
                setLoginType("SELLER");
                setError("");
                setSuccess("");
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                loginType === "SELLER"
                  ? "border-black bg-black text-white shadow-lg"
                  : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
              }`}
            >

              <div className="text-2xl">
                🏪
              </div>

              <p className="mt-3 text-sm font-black">
                I want to Sell
              </p>

              <p
                className={`mt-1 text-[10px] leading-4 ${
                  loginType === "SELLER"
                    ? "text-gray-300"
                    : "text-gray-500"
                }`}
              >
                List your products and
                sell to ANJIVO buyers.
              </p>

            </button>

          </div>


          {/* =====================================
              LOGIN CARD
          ===================================== */}

          <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">

            {/* LOGIN TYPE */}

            <div className="rounded-2xl bg-gray-50 p-4">

              <div className="flex items-start gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-lg text-white">
                  {loginType === "BUYER"
                    ? "🛒"
                    : "🏪"}
                </div>

                <div>

                  <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                    {loginType === "BUYER"
                      ? "Buyer Login"
                      : "Seller Login"}
                  </p>

                  <h2 className="mt-1 text-lg font-black">
                    {loginType === "BUYER"
                      ? "Login to Buy"
                      : "Login to Sell"}
                  </h2>

                  <p className="mt-1 text-[11px] leading-5 text-gray-500">

                    {loginType === "BUYER"
                      ? "Access your orders, cart, wishlist and wholesale buying."
                      : "Access your seller dashboard, products, orders and earnings."}

                  </p>

                </div>

              </div>

            </div>


            {/* =================================
                ERROR
            ================================= */}

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
                ⚠️ {error}
              </div>
            )}


            {/* =================================
                SUCCESS
            ================================= */}

            {success && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold leading-5 text-gray-700">
                ✓ {success}
              </div>
            )}


            {/* =================================
                FORM
            ================================= */}

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >

              {/* EMAIL */}

              <div>

                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-bold text-gray-700"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />

              </div>


              {/* PASSWORD */}

              <div>

                <div className="mb-1.5 flex items-center justify-between gap-3">

                  <label
                    htmlFor="password"
                    className="text-xs font-bold text-gray-700"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={
                      handleForgotPassword
                    }
                    disabled={
                      resettingPassword
                    }
                    className="text-[10px] font-bold text-gray-500 transition hover:text-black disabled:opacity-50"
                  >
                    {resettingPassword
                      ? "Sending..."
                      : "Forgot Password?"}
                  </button>

                </div>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />

              </div>


              {/* LOGIN */}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Signing in..."
                  : loginType === "BUYER"
                    ? "Login as Buyer"
                    : "Login as Seller"}
              </button>

            </form>


            {/* =================================
                CREATE ACCOUNT
            ================================= */}

            <div className="mt-7 border-t border-gray-100 pt-6">

              {loginType === "BUYER" ? (

                <div className="text-center">

                  <p className="text-xs text-gray-500">
                    New to ANJIVO?
                  </p>

                  <Link
                    href="/register?type=buyer"
                    className="mt-2 inline-flex rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-black transition hover:border-black"
                  >
                    Create Buyer Account →
                  </Link>

                  <p className="mt-3 text-[10px] text-gray-400">
                    Retail customers and wholesale buyers
                    can use a Buyer account.
                  </p>

                </div>

              ) : (

                <div className="text-center">

                  <p className="text-xs text-gray-500">
                    Want to sell on ANJIVO?
                  </p>

                  <Link
                    href="/seller/register"
                    className="mt-2 inline-flex rounded-xl bg-black px-5 py-2.5 text-xs font-black text-white transition hover:bg-gray-800"
                  >
                    Start Selling on ANJIVO →
                  </Link>

                  <p className="mt-3 text-[10px] leading-4 text-gray-400">
                    Seller registration requires business
                    details and approval by ANJIVO.
                  </p>

                </div>

              )}

            </div>

          </div>


          {/* =====================================
              HOW ANJIVO WORKS
          ===================================== */}

          <div className="mt-6 grid grid-cols-2 gap-3">

            <div className="rounded-2xl border border-gray-200 bg-white p-4">

              <div className="text-xl">
                🛒
              </div>

              <h3 className="mt-2 text-xs font-black">
                Buying on ANJIVO
              </h3>

              <p className="mt-1 text-[10px] leading-4 text-gray-500">
                Find products, compare prices,
                buy retail or wholesale.
              </p>

            </div>


            <div className="rounded-2xl border border-gray-200 bg-white p-4">

              <div className="text-xl">
                🏪
              </div>

              <h3 className="mt-2 text-xs font-black">
                Selling on ANJIVO
              </h3>

              <p className="mt-1 text-[10px] leading-4 text-gray-500">
                List products, receive orders
                and manage your business.
              </p>

            </div>

          </div>


          {/* =====================================
              TRUST
          ===================================== */}

          <div className="mt-5 grid grid-cols-3 gap-2">

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">

              <div className="text-sm">
                🔒
              </div>

              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Secure Login
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">

              <div className="text-sm">
                ✓
              </div>

              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Verified Sellers
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">

              <div className="text-sm">
                🛡️
              </div>

              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Protected
              </p>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}
