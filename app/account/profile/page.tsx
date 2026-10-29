
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type UserProfile = {
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  customerType?: string;
  accountStatus?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Kuch galat ho gaya. Dobara try karein.";
}

export default function AccountProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async (currentUser: User) => {
    await currentUser.reload();

    const freshUser = auth.currentUser;

    if (!freshUser) {
      router.replace("/login?redirect=/account/profile");
      return;
    }

    if (!freshUser.emailVerified || !freshUser.phoneNumber) {
      router.replace("/verify");
      return;
    }

    const snapshot = await getDoc(doc(db, "users", freshUser.uid));

    if (!snapshot.exists()) {
      throw new Error("Account profile nahi mila. Support se contact karein.");
    }

    const data = snapshot.data() as UserProfile;

    if (data.accountStatus && data.accountStatus !== "ACTIVE") {
      router.replace("/verify");
      return;
    }

    setUser(freshUser);
    setProfile(data);
    setName(data.name || freshUser.displayName || "");
  }, [router]);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login?redirect=/account/profile");
        setLoading(false);
        return;
      }

      try {
        await loadProfile(currentUser);
      } catch (err) {
        console.error("Load account profile failed:", err);
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadProfile, router]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const cleanName = name.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      setError("Naam 2 se 80 characters ke beech hona chahiye.");
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser || !user || currentUser.uid !== user.uid) {
      setError("Session expire ho gaya. Dobara login karein.");
      router.replace("/login?redirect=/account/profile");
      return;
    }

    setSaving(true);

    try {
      await currentUser.reload();

      if (!currentUser.emailVerified || !currentUser.phoneNumber) {
        router.replace("/verify");
        return;
      }

      await updateDoc(doc(db, "users", currentUser.uid), {
        name: cleanName,
        updatedAt: serverTimestamp(),
      });

      await updateProfile(currentUser, {
        displayName: cleanName,
      });

      setProfile((previous) =>
        previous ? { ...previous, name: cleanName } : previous
      );

      setName(cleanName);
      setNotice("Profile successfully update ho gaya.");
    } catch (err) {
      console.error("Update account profile failed:", err);
      setError(
        "Profile save nahi ho saka. Firestore rules ya connection check karein. " +
        getErrorMessage(err)
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 text-center">
          <p className="text-sm text-gray-500">Profile load ho raha hai...</p>
        </div>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8">
          <h1 className="text-xl font-bold">Profile open nahi ho saka</h1>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <Link href="/account" className="mt-5 inline-block font-semibold underline">
            Back to My Account
          </Link>
        </div>
      </main>
    );
  }

  const roleLabel =
    profile.role === "WHOLESALE_CUSTOMER"
      ? "Wholesale Customer"
      : profile.role === "SELLER"
        ? "Seller"
        : "Retail Customer";

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-8 text-gray-950 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              ANJIVO Account
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              My Profile
            </h1>
          </div>

          <Link
            href="/account"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold hover:border-black"
          >
            Back
          </Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-black p-6 text-white sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl font-black text-black">
                {(profile.name || user.displayName || "A")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-black">
                  {profile.name || user.displayName || "ANJIVO Customer"}
                </h2>
                <p className="mt-1 text-sm text-gray-300">{roleLabel}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-8">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {notice && (
              <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {notice}
              </div>
            )}

            <div>
              <label htmlFor="profile-name" className="mb-2 block text-sm font-bold">
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="profile-email" className="mb-2 block text-sm font-bold">
                Email Address
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email || user.email || ""}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Verified email yahan se change nahi hoga.
              </p>
            </div>

            <div>
              <label htmlFor="profile-phone" className="mb-2 block text-sm font-bold">
                Verified Mobile Number
              </label>
              <input
                id="profile-phone"
                type="text"
                value={user.phoneNumber || profile.phone || ""}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Mobile number verification/login se linked hai.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">Customer Type</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold">
                {roleLabel}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || name.trim().length < 2}
              className="w-full rounded-xl bg-black px-5 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving profile..." : "Save Changes"}
            </button>

            <p className="text-xs leading-5 text-gray-500">
              Account ki security ke liye email aur verified mobile number
              is page par read-only hain.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
