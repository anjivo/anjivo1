"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { registerCustomer } from "@/lib/auth";

type BuyerType =
  | "RETAIL_CUSTOMER"
  | "WHOLESALE_CUSTOMER";

type RegistrationType =
  | "BUYER"
  | "SELLER";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialType =
    searchParams.get("type") === "seller"
      ? "SELLER"
      : "BUYER";

  const [registrationType, setRegistrationType] =
    useState<RegistrationType>(initialType);

  const [buyerType, setBuyerType] =
    useState<BuyerType>("RETAIL_CUSTOMER");

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!name.trim()) {
      setError(
        "Please enter your full name."
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Please enter your email address."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      password !== confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    /*
     * Seller registration is handled
     * separately because sellers need
     * business/KYC information.
     */

    if (
      registrationType === "SELLER"
    ) {
      router.push(
        "/seller/register"
      );
      return;
    }

    try {
      setLoading(true);

      await registerCustomer(
        name,
        email,
        password,
        buyerType
      );

      router.push("/account");

    } catch (err: unknown) {
      console.error(
        "Registration error:",
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
          "auth/email-already-in-use"
        ) {
          setError(
            "This email is already registered. Please login instead."
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
          "auth/weak-password"
        ) {
          setError(
            "Password is too weak. Please use a stronger password."
          );
        } else {
          setError(
            "Registration failed. Please try again."
          );
        }
      } else {
        setError(
          "Registration failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
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
            href="/login"
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:border-black"
          >
            Login
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
              ✨
            </div>

            <h1 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
              Join ANJIVO
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              First choose what you want to do on ANJIVO.
            </p>

          </div>


          {/* =====================================
              BUY / SELL SELECTOR
          ===================================== */}

          <div className="mt-7">

            <p className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500">
              What do you want to do?
            </p>

            <div className="grid gap-3 sm:grid-cols-2">

              {/* ================= BUY ================= */}

              <button
                type="button"
                onClick={() => {
                  setRegistrationType(
                    "BUYER"
                  );
                  setError("");
                }}
                className={`rounded-2xl border p-5 text-left transition ${
                  registrationType ===
                  "BUYER"
                    ? "border-black bg-black text-white shadow-lg"
                    : "border-gray-200 bg-white hover:border-gray-400"
                }`}
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
                    🛒
                  </div>

                  {registrationType ===
                    "BUYER" && (
                    <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-black">
                      SELECTED
                    </span>
                  )}

                </div>

                <h2 className="mt-4 text-base font-black">
                  I Want to Buy
                </h2>

                <p
                  className={`mt-2 text-[11px] leading-5 ${
                    registrationType ===
                    "BUYER"
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}
                >
                  Shop products for yourself
                  or buy products in bulk for
                  your business.
                </p>

                <div
                  className={`mt-4 space-y-1 text-[10px] ${
                    registrationType ===
                    "BUYER"
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}
                >
                  <p>✓ Retail shopping</p>
                  <p>✓ Wholesale / bulk buying</p>
                  <p>✓ Orders & wishlist</p>
                </div>

              </button>


              {/* ================= SELL ================= */}

              <button
                type="button"
                onClick={() => {
                  setRegistrationType(
                    "SELLER"
                  );
                  setError("");
                }}
                className={`rounded-2xl border p-5 text-left transition ${
                  registrationType ===
                  "SELLER"
                    ? "border-black bg-black text-white shadow-lg"
                    : "border-gray-200 bg-white hover:border-gray-400"
                }`}
              >

                <div className="flex items-start justify-between">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
                    🏪
                  </div>

                  {registrationType ===
                    "SELLER" && (
                    <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-black">
                      SELECTED
                    </span>
                  )}

                </div>

                <h2 className="mt-4 text-base font-black">
                  I Want to Sell
                </h2>

                <p
                  className={`mt-2 text-[11px] leading-5 ${
                    registrationType ===
                    "SELLER"
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}
                >
                  List your products on
                  ANJIVO and sell to retail
                  and wholesale buyers.
                </p>

                <div
                  className={`mt-4 space-y-1 text-[10px] ${
                    registrationType ===
                    "SELLER"
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}
                >
                  <p>✓ List your products</p>
                  <p>✓ Retail + wholesale sales</p>
                  <p>✓ Seller dashboard</p>
                </div>

              </button>

            </div>

          </div>


          {/* =====================================
              SELLER SELECTED
          ===================================== */}

          {registrationType ===
            "SELLER" ? (

            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">

              <div className="rounded-2xl bg-gray-50 p-5">

                <div className="flex items-start gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-xl text-white">
                    🏪
                  </div>

                  <div>

                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Seller Registration
                    </p>

                    <h2 className="mt-1 text-lg font-black">
                      Start selling on ANJIVO
                    </h2>

                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      Seller registration requires
                      your business, contact and
                      verification details.
                    </p>

                  </div>

                </div>

              </div>


              <div className="mt-5 space-y-3">

                <SellerFeature
                  icon="📦"
                  title="List Products"
                  text="Add your products with retail and wholesale pricing."
                />

                <SellerFeature
                  icon="🛒"
                  title="Receive Orders"
                  text="Sell to retail customers and bulk buyers."
                />

                <SellerFeature
                  icon="📊"
                  title="Manage Business"
                  text="Manage products, stock, orders and earnings from your dashboard."
                />

                <SellerFeature
                  icon="✓"
                  title="Seller Verification"
                  text="Your seller application will be reviewed by ANJIVO."
                />

              </div>


              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
                  ⚠️ {error}
                </div>
              )}


              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/seller/register"
                  )
                }
                className="mt-6 w-full rounded-xl bg-black py-3.5 text-sm font-black text-white transition hover:bg-gray-800"
              >
                Continue to Seller Registration →
              </button>


              <button
                type="button"
                onClick={() => {
                  setRegistrationType(
                    "BUYER"
                  );
                  setError("");
                }}
                className="mt-3 w-full rounded-xl border border-gray-200 py-3 text-xs font-bold text-gray-700 transition hover:border-black hover:text-black"
              >
                ← I want to buy instead
              </button>

            </div>

          ) : (

            /* =====================================
               BUYER REGISTRATION
            ===================================== */

            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">

              <div className="rounded-2xl bg-gray-50 p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-lg text-white">
                    🛒
                  </div>

                  <div>

                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Buyer Account
                    </p>

                    <h2 className="mt-1 text-lg font-black">
                      Create your buyer account
                    </h2>

                    <p className="mt-1 text-[11px] leading-5 text-gray-500">
                      Choose whether you mainly want
                      retail shopping or wholesale buying.
                    </p>

                  </div>

                </div>

              </div>


              {/* =================================
                  BUYER TYPE
              ================================= */}

              <div className="mt-6">

                <p className="mb-2 text-xs font-bold text-gray-700">
                  What will you buy?
                </p>

                <div className="grid grid-cols-2 gap-2">

                  {/* RETAIL */}

                  <button
                    type="button"
                    onClick={() =>
                      setBuyerType(
                        "RETAIL_CUSTOMER"
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition ${
                      buyerType ===
                      "RETAIL_CUSTOMER"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-black"
                    }`}
                  >

                    <div className="text-lg">
                      🛍️
                    </div>

                    <p className="mt-1 text-xs font-black">
                      Retail Buyer
                    </p>

                    <p
                      className={`mt-1 text-[9px] ${
                        buyerType ===
                        "RETAIL_CUSTOMER"
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    >
                      Buy for yourself
                    </p>

                  </button>


                  {/* WHOLESALE */}

                  <button
                    type="button"
                    onClick={() =>
                      setBuyerType(
                        "WHOLESALE_CUSTOMER"
                      )
                    }
                    className={`rounded-xl border p-3 text-left transition ${
                      buyerType ===
                      "WHOLESALE_CUSTOMER"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-black"
                    }`}
                  >

                    <div className="text-lg">
                      📦
                    </div>

                    <p className="mt-1 text-xs font-black">
                      Wholesale Buyer
                    </p>

                    <p
                      className={`mt-1 text-[9px] ${
                        buyerType ===
                        "WHOLESALE_CUSTOMER"
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    >
                      Buy in bulk
                    </p>

                  </button>

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
                  FORM
              ================================= */}

              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >

                {/* NAME */}

                <div>

                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-xs font-bold text-gray-700"
                  >
                    Full Name
                  </label>

                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                  />

                </div>


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

                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-bold text-gray-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                  />

                </div>


                {/* CONFIRM PASSWORD */}

                <div>

                  <label
                    htmlFor="confirmPassword"
                    className="mb-1.5 block text-xs font-bold text-gray-700"
                  >
                    Confirm Password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                  />

                </div>


                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Creating account..."
                    : "Create Buyer Account"}
                </button>

              </form>


              <p className="mt-4 text-center text-[10px] leading-5 text-gray-400">
                You can use your Buyer account
                for retail shopping or wholesale
                purchases.
              </p>

            </div>

          )}


          {/* =====================================
              LOGIN
          ===================================== */}

          <div className="mt-6 text-center">

            <p className="text-xs text-gray-500">
              Already have an ANJIVO account?
            </p>

            <Link
              href="/login"
              className="mt-1 inline-block text-sm font-black text-black hover:underline"
            >
              Login to ANJIVO →
            </Link>

          </div>


          {/* =====================================
              TRUST
          ===================================== */}

          <div className="mt-6 grid grid-cols-3 gap-2">

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">

              <div className="text-sm">
                🔒
              </div>

              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Secure
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">

              <div className="text-sm">
                ✓
              </div>

              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Verified
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


          {/* =====================================
              TERMS
          ===================================== */}

          <p className="mt-5 text-center text-[10px] leading-5 text-gray-400">
            By creating an account, you agree to
            ANJIVO&apos;s Terms & Conditions and
            Privacy Policy.
          </p>

        </div>

      </main>

    </div>
  );
}


/* =============================================
   SELLER FEATURE
============================================= */

function SellerFeature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-3">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">
        {icon}
      </div>

      <div>

        <h3 className="text-xs font-black">
          {title}
        </h3>

        <p className="mt-1 text-[10px] leading-4 text-gray-500">
          {text}
        </p>

      </div>

    </div>
  );
}
