"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getPendingSellerApplications,
  updateSellerStatus,
  type SellerApplication,
} from "@/lib/admin-sellers";

export default function AdminSellersPage() {
  const router = useRouter();

  const [sellers, setSellers] =
    useState<SellerApplication[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/admin/sellers"
            );
            return;
          }

          try {
            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !userSnapshot.exists() ||
              userSnapshot.data()
                .role !== "ADMIN"
            ) {
              setError(
                "Admin access required."
              );
              return;
            }

            const result =
              await getPendingSellerApplications();

            setSellers(result);
          } catch (err) {
            console.error(err);

            setError(
              "Unable to load seller applications."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  async function handleApprove(
    seller: SellerApplication
  ) {
    try {
      setProcessing(
        seller.id
      );

      await updateSellerStatus(
        seller.id,
        seller.userId,
        "approved"
      );

      setSellers(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== seller.id
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to approve seller."
      );
    } finally {
      setProcessing("");
    }
  }

  async function handleReject(
    seller: SellerApplication
  ) {
    const reason =
      window.prompt(
        "Enter rejection reason:"
      );

    if (reason === null) {
      return;
    }

    try {
      setProcessing(
        seller.id
      );

      await updateSellerStatus(
        seller.id,
        seller.userId,
        "rejected",
        reason
      );

      setSellers(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== seller.id
          )
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to reject seller."
      );
    } finally {
      setProcessing("");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            ⏳ Loading seller applications...
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center">

            <div className="text-5xl">
              🔒
            </div>

            <h1 className="mt-4 text-xl font-black">
              Access Denied
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {error}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Go Home
            </Link>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        <div className="mb-7">

          <Link
            href="/admin"
            className="text-xs font-bold text-gray-400 hover:text-black"
          >
            ← Admin Dashboard
          </Link>

          <h1 className="mt-3 text-3xl font-black">
            Seller Applications
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review and approve businesses that want to sell on ANJIVO.
          </p>

        </div>

        {sellers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">

            <div className="text-5xl">
              🎉
            </div>

            <h2 className="mt-4 text-xl font-black">
              No pending applications
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              There are no seller applications waiting for review.
            </p>

          </div>
        ) : (
          <div className="space-y-5">

            {sellers.map(
              (seller) => (
                <div
                  key={seller.id}
                  className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7"
                >

                  <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-[9px] font-bold text-yellow-700">
                        PENDING
                      </span>

                      <h2 className="mt-3 text-xl font-black">
                        {seller.businessName}
                      </h2>

                      <p className="mt-1 text-xs text-gray-400">
                        {seller.businessType}
                        {" • "}
                        {seller.category}
                      </p>
                    </div>

                    <div className="flex gap-2">

                      <button
                        type="button"
                        disabled={
                          processing ===
                          seller.id
                        }
                        onClick={() =>
                          handleApprove(
                            seller
                          )
                        }
                        className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        {processing ===
                        seller.id
                          ? "Processing..."
                          : "✓ Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          processing ===
                          seller.id
                        }
                        onClick={() =>
                          handleReject(
                            seller
                          )
                        }
                        className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 disabled:opacity-40"
                      >
                        Reject
                      </button>

                    </div>

                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-[9px] uppercase tracking-wider text-gray-400">
                        Owner
                      </p>

                      <p className="mt-1 text-sm font-bold">
                        {seller.ownerName}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {seller.phone}
                      </p>

                      <p className="mt-1 break-all text-xs text-gray-500">
                        {seller.email}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-[9px] uppercase tracking-wider text-gray-400">
                        Business Address
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-600">
                        {seller.address}
                        <br />
                        {seller.city},{" "}
                        {seller.state} -{" "}
                        {seller.pincode}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-[9px] uppercase tracking-wider text-gray-400">
                        KYC
                      </p>

                      <p className="mt-2 text-xs">
                        <strong>
                          GST:
                        </strong>{" "}
                        {seller.gstNumber ||
                          "Not provided"}
                      </p>

                      <p className="mt-1 text-xs">
                        <strong>
                          PAN:
                        </strong>{" "}
                        {seller.panNumber ||
                          "Not provided"}
                      </p>
                    </div>

                  </div>

                  {seller.bankAccountName && (
                    <div className="mt-4 rounded-2xl border border-gray-100 p-4">

                      <p className="text-[9px] uppercase tracking-wider text-gray-400">
                        Bank Details
                      </p>

                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">

                        <p>
                          <strong>
                            Name:
                          </strong>{" "}
                          {seller.bankAccountName}
                        </p>

                        <p>
                          <strong>
                            Account:
                          </strong>{" "}
                          {seller.bankAccountNumber ||
                            "—"}
                        </p>

                        <p>
                          <strong>
                            IFSC:
                          </strong>{" "}
                          {seller.ifscCode ||
                            "—"}
                        </p>

                      </div>

                    </div>
                  )}

                </div>
              )
            )}

          </div>
        )}

      </main>

      <Footer />

    </div>
  );
}
