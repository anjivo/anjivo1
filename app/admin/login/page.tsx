"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { loginUser } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter the Admin email address.");
      return;
    }

    if (!password) {
      setError("Please enter the Admin password.");
      return;
    }

    try {
      setLoading(true);

      const user = await loginUser(email, password);
      const userSnapshot = await getDoc(doc(db, "users", user.uid));

      if (!userSnapshot.exists()) {
        await auth.signOut();
        setError(
          "Admin profile not found. Please create the users document with role ADMIN first."
        );
        return;
      }

      const userData = userSnapshot.data();
      const role = String(userData.role ?? "").trim().toUpperCase();
      const accountStatus = String(
        userData.accountStatus ?? "ACTIVE"
      )
        .trim()
        .toUpperCase();

      if (role !== "ADMIN") {
        await auth.signOut();
        setError("This account does not have Admin access.");
        return;
      }

      if (accountStatus !== "ACTIVE") {
        await auth.signOut();
        setError(
          `This Admin account is currently ${accountStatus.toLowerCase()}. Please contact the account owner.`
        );
        return;
      }

      router.replace("/admin");
    } catch (err: unknown) {
      console.error("Admin login error:", err);

      if (err && typeof err === "object" && "code" in err) {
        const code = String(
          (err as { code?: string }).code ?? ""
        );

        if (
          code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found"
        ) {
          setError("Admin email or password is incorrect.");
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid Admin email address.");
        } else if (code === "auth/too-many-requests") {
          setError(
            "Too many login attempts. Please try again later."
          );
        } else {
          setError("Admin login failed. Please try again.");
        }
      } else {
        setError("Admin login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError(
        "Enter your Admin email address first, then click Forgot Password."
      );
      return;
    }

    try {
      setResettingPassword(true);

      await sendPasswordResetEmail(auth, email.trim().toLowerCase());

      setSuccess(
        "Password reset email has been sent. Please check your inbox."
      );
    } catch (err: unknown) {
      console.error("Admin password reset error:", err);

      if (err && typeof err === "object" && "code" in err) {
        const code = String(
          (err as { code?: string }).code ?? ""
        );

        if (code === "auth/user-not-found") {
          setError("No ANJIVO Admin account was found with this email.");
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid Admin email address.");
        } else {
          setError(
            "Could not send the password reset email. Please try again."
          );
        }
      } else {
        setError(
          "Could not send the password reset email. Please try again."
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
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
            Buyer / Seller Login
          </Link>
        </div>
      </header>

      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-md">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white shadow-lg">
              🔐
            </div>

            <h1 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
              ANJIVO Admin Login
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
              Secure access for the ANJIVO platform administrator.
            </p>
          </div>

          <div className="mt-7 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-lg text-white">
                  🛡️
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                    Administrator Access
                  </p>
                  <p className="mt-1 text-sm font-black">
                    Full ANJIVO Control Center
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    Manage sellers, products, customers, orders, finance and marketplace operations.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold leading-5 text-gray-700">
                ✓ {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="mb-2 block text-xs font-black text-gray-700"
                >
                  Admin Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="admin@anjivo.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2 block text-xs font-black text-gray-700"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter Admin password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-black px-5 py-3.5 text-sm font-black text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Login to Admin Panel →"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resettingPassword}
              className="mt-4 w-full text-center text-xs font-bold text-gray-500 transition hover:text-black disabled:opacity-50"
            >
              {resettingPassword
                ? "Sending reset email..."
                : "Forgot Admin Password?"}
            </button>

            <div className="mt-6 border-t border-gray-100 pt-5 text-center">
              <p className="text-[10px] leading-5 text-gray-400">
                Admin access is controlled by the ANJIVO user role. Only an account with
                <span className="font-black text-gray-600"> role = ADMIN </span>
                and
                <span className="font-black text-gray-600"> accountStatus = ACTIVE </span>
                can continue.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              href="/login"
              className="rounded-2xl border border-gray-200 bg-white p-4 text-center text-xs font-black transition hover:border-black"
            >
              🛒 Buyer / Seller
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-gray-200 bg-white p-4 text-center text-xs font-black transition hover:border-black"
            >
              🏠 ANJIVO Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
