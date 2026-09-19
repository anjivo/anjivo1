"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { loginUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      await loginUser(email, password);

      router.push("/account");
    } catch (err: unknown) {
      console.error(err);

      if (
        err &&
        typeof err === "object" &&
        "code" in err
      ) {
        const code = String(
          (err as { code?: string }).code
        );

        if (
          code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found"
        ) {
          setError(
            "Email or password is incorrect."
          );
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid email address.");
        } else if (code === "auth/too-many-requests") {
          setError(
            "Too many attempts. Please try again later."
          );
        } else {
          setError("Login failed. Please try again.");
        }
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">

      {/* ================= HEADER ================= */}
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

      {/* ================= LOGIN ================= */}
      <main className="px-4 py-8 sm:py-12">

        <div className="mx-auto max-w-md">

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">

            <div className="text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-2xl">
                👤
              </div>

              <h1 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
                Welcome back
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Login to your ANJIVO account to continue shopping.
              </p>

            </div>

            {/* ================= ERROR ================= */}
            {error && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700">
                ⚠️ {error}
              </div>
            )}

            {/* ================= FORM ================= */}
            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >

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
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />
              </div>

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
                    className="text-[10px] font-bold text-gray-500 transition hover:text-black"
                  >
                    Forgot Password?
                  </button>

                </div>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Signing in..."
                  : "Login"}
              </button>

            </form>

            {/* ================= REGISTER ================= */}
            <div className="mt-6 border-t border-gray-100 pt-5 text-center">

              <p className="text-xs text-gray-500">
                Don't have an ANJIVO account?
              </p>

              <Link
                href="/register"
                className="mt-1 inline-block text-sm font-black text-black hover:underline"
              >
                Create Account →
              </Link>

            </div>

          </div>

          {/* ================= TRUST ================= */}
          <div className="mt-6 grid grid-cols-3 gap-2">

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <div className="text-sm">🔒</div>
              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Secure
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <div className="text-sm">✓</div>
              <p className="mt-1 text-[9px] font-bold text-gray-500">
                Verified
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <div className="text-sm">🛡️</div>
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
