"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { registerCustomer } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [customerType, setCustomerType] = useState<
    "RETAIL_CUSTOMER" | "WHOLESALE_CUSTOMER"
  >("RETAIL_CUSTOMER");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await registerCustomer(
        name,
        email,
        password,
        customerType
      );

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

        if (code === "auth/email-already-in-use") {
          setError(
            "This email is already registered. Please login."
          );
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid email address.");
        } else if (code === "auth/weak-password") {
          setError("Password is too weak.");
        } else {
          setError("Registration failed. Please try again.");
        }
      } else {
        setError("Registration failed. Please try again.");
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

      {/* ================= REGISTER ================= */}
      <main className="px-4 py-8 sm:py-12">

        <div className="mx-auto max-w-md">

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">

            <div className="text-center">

              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Create your ANJIVO account
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Shop retail, buy wholesale and manage your orders
                from one account.
              </p>

            </div>

            {/* ================= ACCOUNT TYPE ================= */}
            <div className="mt-7">

              <p className="mb-2 text-xs font-bold text-gray-700">
                Account Type
              </p>

              <div className="grid grid-cols-2 gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setCustomerType("RETAIL_CUSTOMER")
                  }
                  className={`rounded-xl border p-3 text-left transition ${
                    customerType === "RETAIL_CUSTOMER"
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-black"
                  }`}
                >
                  <div className="text-lg">🛍️</div>

                  <p className="mt-1 text-xs font-black">
                    Retail
                  </p>

                  <p
                    className={`mt-1 text-[9px] ${
                      customerType === "RETAIL_CUSTOMER"
                        ? "text-gray-300"
                        : "text-gray-400"
                    }`}
                  >
                    Shop for yourself
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCustomerType("WHOLESALE_CUSTOMER")
                  }
                  className={`rounded-xl border p-3 text-left transition ${
                    customerType === "WHOLESALE_CUSTOMER"
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-black"
                  }`}
                >
                  <div className="text-lg">📦</div>

                  <p className="mt-1 text-xs font-black">
                    Wholesale
                  </p>

                  <p
                    className={`mt-1 text-[9px] ${
                      customerType === "WHOLESALE_CUSTOMER"
                        ? "text-gray-300"
                        : "text-gray-400"
                    }`}
                  >
                    Buy in bulk
                  </p>
                </button>

              </div>
            </div>

            {/* ================= ERROR ================= */}
            {error && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-700">
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
                    setName(event.target.value)
                  }
                  placeholder="Enter your name"
                  autoComplete="name"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />
              </div>

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
                    setPassword(event.target.value)
                  }
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />
              </div>

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
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating account..."
                  : "Create Account"}
              </button>

            </form>

            {/* ================= LOGIN ================= */}
            <div className="mt-6 border-t border-gray-100 pt-5 text-center">

              <p className="text-xs text-gray-500">
                Already have an account?
              </p>

              <Link
                href="/login"
                className="mt-1 inline-block text-sm font-black text-black hover:underline"
              >
                Login to ANJIVO →
              </Link>

            </div>

          </div>

          <p className="mt-5 text-center text-[10px] leading-5 text-gray-400">
            By creating an account, you agree to ANJIVO&apos;s
            Terms & Conditions and Privacy Policy.
          </p>

        </div>

      </main>
    </div>
  );
}
