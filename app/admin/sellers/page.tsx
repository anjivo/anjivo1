"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type SellerStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "blocked";

type Seller = {
  id: string;
  userId: string;

  businessName: string;
  ownerName: string;

  email: string;
  phone: string;

  businessType: string;
  category: string;

  address: string;
  city: string;
  state: string;
  pincode: string;

  gstNumber?: string;
  panNumber?: string;

  bankAccountName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;

  status: SellerStatus;

  sellerVerified: boolean;

  emailVerified: boolean;
  phoneVerified: boolean;
  gstVerified: boolean;
  panVerified: boolean;
  bankVerified: boolean;

  adminApproved: boolean;
  accountStatus: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type SellerFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "blocked";

/* =========================================================
   HELPERS
========================================================= */

function getTimestampValue(
  value: unknown
): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    return Number(
      (value as { seconds?: unknown })
        .seconds ?? 0
    );
  }

  if (value instanceof Date) {
    return Math.floor(
      value.getTime() / 1000
    );
  }

  return 0;
}

function stringValue(
  value: unknown
): string {
  return value === undefined ||
    value === null
    ? ""
    : String(value);
}

function booleanValue(
  value: unknown
): boolean {
  return value === true;
}

function mapSeller(
  id: string,
  data: Record<string, unknown>
): Seller {
  const rawStatus =
    stringValue(data.status);

  let status: SellerStatus =
    "pending";

  if (
    rawStatus === "approved" ||
    rawStatus === "rejected" ||
    rawStatus === "blocked"
  ) {
    status =
      rawStatus as SellerStatus;
  }

  return {
    id,

    userId: stringValue(
      data.userId
    ),

    businessName: stringValue(
      data.businessName
    ),

    ownerName: stringValue(
      data.ownerName
    ),

    email: stringValue(
      data.email
    ),

    phone: stringValue(
      data.phone
    ),

    businessType: stringValue(
      data.businessType
    ),

    category: stringValue(
      data.category
    ),

    address: stringValue(
      data.address
    ),

    city: stringValue(
      data.city
    ),

    state: stringValue(
      data.state
    ),

    pincode: stringValue(
      data.pincode
    ),

    gstNumber:
      data.gstNumber
        ? stringValue(
            data.gstNumber
          )
        : undefined,

    panNumber:
      data.panNumber
        ? stringValue(
            data.panNumber
          )
        : undefined,

    bankAccountName:
      data.bankAccountName
        ? stringValue(
            data.bankAccountName
          )
        : undefined,

    bankAccountNumber:
      data.bankAccountNumber
        ? stringValue(
            data.bankAccountNumber
          )
        : undefined,

    ifscCode:
      data.ifscCode
        ? stringValue(
            data.ifscCode
          )
        : undefined,

    status,

    sellerVerified:
      booleanValue(
        data.sellerVerified
      ),

    emailVerified:
      booleanValue(
        data.emailVerified
      ),

    phoneVerified:
      booleanValue(
        data.phoneVerified
      ),

    gstVerified:
      booleanValue(
        data.gstVerified
      ),

    panVerified:
      booleanValue(
        data.panVerified
      ),

    bankVerified:
      booleanValue(
        data.bankVerified
      ),

    adminApproved:
      booleanValue(
        data.adminApproved
      ),

    accountStatus:
      stringValue(
        data.accountStatus
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminSellersPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [sellers, setSellers] =
    useState<Seller[]>([]);

  const [filter, setFilter] =
    useState<SellerFilter>(
      "all"
    );

  const [search, setSearch] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =========================================================
     ADMIN AUTH
  ========================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/sellers";
            return;
          }

          try {
            setError("");

            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !userSnapshot.exists()
            ) {
              window.location.href =
                "/";
              return;
            }

            const userData =
              userSnapshot.data();

            if (
              userData.role !==
              "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadSellers();
          } catch (err) {
            console.error(
              "Admin seller auth error:",
              err
            );

            setError(
              "Unable to verify admin access."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  /* =========================================================
     LOAD SELLERS
  ========================================================= */

  async function loadSellers() {
    try {
      setError("");

      /*
       * No orderBy("createdAt") here.
       *
       * This keeps the page compatible with
       * older seller documents where createdAt
       * may be missing.
       */
      const snapshot =
        await getDocs(
          collection(
            db,
            "sellers"
          )
        );

      const list: Seller[] =
        snapshot.docs.map(
          (item) =>
            mapSeller(
              item.id,
              item.data()
            )
        );

      list.sort(
        (a, b) =>
          getTimestampValue(
            b.createdAt
          ) -
          getTimestampValue(
            a.createdAt
          )
      );

      setSellers(list);
    } catch (err) {
      console.error(
        "Load sellers error:",
        err
      );

      setError(
        "Seller applications load nahi ho paaye."
      );
    }
  }

  /* =========================================================
     APPROVE SELLER
  ========================================================= */

  async function approveSeller(
    seller: Seller
  ) {
    const confirmed =
      window.confirm(
        `Approve seller "${seller.businessName}"?\n\nAfter approval, this seller can access the seller marketplace features according to Firestore permissions.`
      );

    if (!confirmed) return;

    try {
      setProcessing(seller.id);
      setError("");
      setSuccess("");

      const sellerRef =
        doc(
          db,
          "sellers",
          seller.id
        );

      const userRef =
        doc(
          db,
          "users",
          seller.userId
        );

      /*
       * Seller document
       */

      await updateDoc(
        sellerRef,
        {
          status: "approved",

          sellerVerified:
            true,

          adminApproved:
            true,

          accountStatus:
            "ACTIVE",

          updatedAt:
            serverTimestamp(),
        }
      );

      /*
       * User document
       *
       * Only admin can change these protected
       * role/application fields according to
       * the intended Firestore rules.
       */

      await updateDoc(
        userRef,
        {
          role: "SELLER",

          sellerApplicationStatus:
            "APPROVED",

          accountStatus:
            "ACTIVE",

          updatedAt:
            serverTimestamp(),
        }
      );

      setSellers(
        (current) =>
          current.map(
            (item) =>
              item.id === seller.id
                ? {
                    ...item,
                    status:
                      "approved",
                    sellerVerified:
                      true,
                    adminApproved:
                      true,
                    accountStatus:
                      "ACTIVE",
                  }
                : item
          )
      );

      setSuccess(
        `${seller.businessName} has been approved successfully.`
      );
    } catch (err) {
      console.error(
        "Approve seller error:",
        err
      );

      setError(
        "Seller approval failed. Check Firestore rules and seller/user documents."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     REJECT SELLER
  ========================================================= */

  async function rejectSeller(
    seller: Seller
  ) {
    const confirmed =
      window.confirm(
        `Reject seller application for "${seller.businessName}"?`
      );

    if (!confirmed) return;

    try {
      setProcessing(seller.id);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "sellers",
          seller.id
        ),
        {
          status: "rejected",

          sellerVerified:
            false,

          adminApproved:
            false,

          accountStatus:
            "REJECTED",

          updatedAt:
            serverTimestamp(),
        }
      );

      await updateDoc(
        doc(
          db,
          "users",
          seller.userId
        ),
        {
          sellerApplicationStatus:
            "REJECTED",

          accountStatus:
            "REJECTED",

          updatedAt:
            serverTimestamp(),
        }
      );

      setSellers(
        (current) =>
          current.map(
            (item) =>
              item.id === seller.id
                ? {
                    ...item,
                    status:
                      "rejected",
                    sellerVerified:
                      false,
                    adminApproved:
                      false,
                    accountStatus:
                      "REJECTED",
                  }
                : item
          )
      );

      setSuccess(
        `${seller.businessName} application rejected.`
      );
    } catch (err) {
      console.error(
        "Reject seller error:",
        err
      );

      setError(
        "Seller rejection failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     BLOCK SELLER
  ========================================================= */

  async function blockSeller(
    seller: Seller
  ) {
    const confirmed =
      window.confirm(
        `Block seller "${seller.businessName}"?\n\nThe seller account will no longer be treated as an approved seller.`
      );

    if (!confirmed) return;

    try {
      setProcessing(seller.id);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "sellers",
          seller.id
        ),
        {
          status: "blocked",

          sellerVerified:
            false,

          adminApproved:
            false,

          accountStatus:
            "BLOCKED",

          updatedAt:
            serverTimestamp(),
        }
      );

      await updateDoc(
        doc(
          db,
          "users",
          seller.userId
        ),
        {
          accountStatus:
            "BLOCKED",

          updatedAt:
            serverTimestamp(),
        }
      );

      setSellers(
        (current) =>
          current.map(
            (item) =>
              item.id === seller.id
                ? {
                    ...item,
                    status:
                      "blocked",
                    sellerVerified:
                      false,
                    adminApproved:
                      false,
                    accountStatus:
                      "BLOCKED",
                  }
                : item
          )
      );

      setSuccess(
        `${seller.businessName} has been blocked.`
      );
    } catch (err) {
      console.error(
        "Block seller error:",
        err
      );

      setError(
        "Seller block failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     UNBLOCK SELLER
  ========================================================= */

  async function unblockSeller(
    seller: Seller
  ) {
    const confirmed =
      window.confirm(
        `Unblock "${seller.businessName}"?`
      );

    if (!confirmed) return;

    try {
      setProcessing(seller.id);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "sellers",
          seller.id
        ),
        {
          status: "approved",

          sellerVerified:
            true,

          adminApproved:
            true,

          accountStatus:
            "ACTIVE",

          updatedAt:
            serverTimestamp(),
        }
      );

      await updateDoc(
        doc(
          db,
          "users",
          seller.userId
        ),
        {
          role: "SELLER",

          sellerApplicationStatus:
            "APPROVED",

          accountStatus:
            "ACTIVE",

          updatedAt:
            serverTimestamp(),
        }
      );

      setSellers(
        (current) =>
          current.map(
            (item) =>
              item.id === seller.id
                ? {
                    ...item,
                    status:
                      "approved",
                    sellerVerified:
                      true,
                    adminApproved:
                      true,
                    accountStatus:
                      "ACTIVE",
                  }
                : item
          )
      );

      setSuccess(
        `${seller.businessName} has been unblocked.`
      );
    } catch (err) {
      console.error(
        "Unblock seller error:",
        err
      );

      setError(
        "Seller unblock failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     SEARCH / FILTER
  ========================================================= */

  const filteredSellers =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return sellers.filter(
        (seller) => {
          const matchesFilter =
            filter === "all" ||
            seller.status ===
              filter;

          const searchableText = [
            seller.businessName,
            seller.ownerName,
            seller.email,
            seller.phone,
            seller.city,
            seller.state,
            seller.category,
            seller.gstNumber,
            seller.panNumber,
            seller.userId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !searchText ||
            searchableText.includes(
              searchText
            );

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );
    }, [
      sellers,
      filter,
      search,
    ]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const counts = useMemo(
    () => ({
      all: sellers.length,

      pending: sellers.filter(
        (seller) =>
          seller.status ===
          "pending"
      ).length,

      approved: sellers.filter(
        (seller) =>
          seller.status ===
          "approved"
      ).length,

      rejected: sellers.filter(
        (seller) =>
          seller.status ===
          "rejected"
      ).length,

      blocked: sellers.filter(
        (seller) =>
          seller.status ===
          "blocked"
      ).length,
    }),
    [sellers]
  );

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Seller Management...
          </p>

        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f6f8]">

      {/* HEADER */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

          <Link href="/">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/admin/products"
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              Products
            </Link>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* TITLE */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / SELLERS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
              Seller Management
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Review seller applications,
              KYC status, approvals and
              account access.
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              loadSellers()
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold hover:border-black"
          >
            ↻ Refresh Sellers
          </button>

        </div>

        {/* ALERTS */}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* STATS */}

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          <SellerCount
            label="All Sellers"
            count={counts.all}
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />

          <SellerCount
            label="Pending"
            count={counts.pending}
            active={
              filter === "pending"
            }
            onClick={() =>
              setFilter(
                "pending"
              )
            }
          />

          <SellerCount
            label="Approved"
            count={counts.approved}
            active={
              filter === "approved"
            }
            onClick={() =>
              setFilter(
                "approved"
              )
            }
          />

          <SellerCount
            label="Rejected"
            count={counts.rejected}
            active={
              filter === "rejected"
            }
            onClick={() =>
              setFilter(
                "rejected"
              )
            }
          />

          <SellerCount
            label="Blocked"
            count={counts.blocked}
            active={
              filter === "blocked"
            }
            onClick={() =>
              setFilter(
                "blocked"
              )
            }
          />

        </div>

        {/* SEARCH */}

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-3">

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search business, owner, phone, email, GST, PAN, city or seller ID..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />

        </div>

        {/* SELLER LIST */}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          {filteredSellers.length ===
          0 ? (
            <div className="p-14 text-center">

              <div className="text-5xl">
                🏪
              </div>

              <h2 className="mt-4 text-lg font-black">
                No sellers found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Try another search or
                filter.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredSellers.map(
                (seller) => (
                  <SellerRow
                    key={seller.id}
                    seller={seller}
                    processing={
                      processing ===
                      seller.id
                    }
                    onApprove={() =>
                      approveSeller(
                        seller
                      )
                    }
                    onReject={() =>
                      rejectSeller(
                        seller
                      )
                    }
                    onBlock={() =>
                      blockSeller(
                        seller
                      )
                    }
                    onUnblock={() =>
                      unblockSeller(
                        seller
                      )
                    }
                  />
                )
              )}

            </div>
          )}

        </div>

      </div>
    </main>
  );
}

/* =========================================================
   COUNT CARD
========================================================= */

function SellerCount({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-black bg-black text-white"
          : "border-gray-200 bg-white hover:border-gray-400"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">
        {count.toLocaleString(
          "en-IN"
        )}
      </p>
    </button>
  );
}

/* =========================================================
   SELLER ROW
========================================================= */

function SellerRow({
  seller,
  processing,
  onApprove,
  onReject,
  onBlock,
  onUnblock,
}: {
  seller: Seller;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const verificationCount = [
    seller.emailVerified,
    seller.phoneVerified,
    seller.gstVerified,
    seller.panVerified,
    seller.bankVerified,
  ].filter(Boolean).length;

  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-6 xl:flex-row xl:justify-between">

        {/* BASIC INFO */}

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h2 className="text-lg font-black text-gray-900">
              {seller.businessName ||
                "Unnamed Business"}
            </h2>

            <SellerStatusBadge
              status={
                seller.status
              }
            />

          </div>

          <p className="mt-1 text-sm text-gray-500">
            Owner:{" "}
            <span className="font-bold text-gray-700">
              {seller.ownerName ||
                "—"}
            </span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">

            <InfoBadge>
              📧{" "}
              {seller.email ||
                "No email"}
            </InfoBadge>

            <InfoBadge>
              📱{" "}
              {seller.phone ||
                "No phone"}
            </InfoBadge>

            <InfoBadge>
              📍{" "}
              {seller.city ||
                "—"}
              {seller.state
                ? `, ${seller.state}`
                : ""}
            </InfoBadge>

            <InfoBadge>
              {seller.businessType ||
                "Business"}
            </InfoBadge>

            <InfoBadge>
              {seller.category ||
                "Category not set"}
            </InfoBadge>

          </div>

          {/* KYC */}

          <div className="mt-5">

            <div className="flex flex-wrap items-center justify-between gap-2">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Verification
              </p>

              <p className="text-[10px] font-bold text-gray-500">
                {verificationCount}/5
                verified
              </p>

            </div>

            <div className="mt-2 flex flex-wrap gap-2">

              <VerificationBadge
                label="Email"
                verified={
                  seller.emailVerified
                }
              />

              <VerificationBadge
                label="Mobile"
                verified={
                  seller.phoneVerified
                }
              />

              <VerificationBadge
                label="GST"
                verified={
                  seller.gstVerified
                }
              />

              <VerificationBadge
                label="PAN"
                verified={
                  seller.panVerified
                }
              />

              <VerificationBadge
                label="Bank"
                verified={
                  seller.bankVerified
                }
              />

            </div>

          </div>

          {/* DOCUMENT DETAILS */}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <DocumentBox
              label="GST"
              value={
                seller.gstNumber ||
                "Not provided"
              }
            />

            <DocumentBox
              label="PAN"
              value={
                seller.panNumber ||
                "Not provided"
              }
            />

            <DocumentBox
              label="Pincode"
              value={
                seller.pincode ||
                "—"
              }
            />

            <DocumentBox
              label="Account"
              value={
                seller.accountStatus ||
                "—"
              }
            />

          </div>

          {/* ADDRESS */}

          <div className="mt-4 rounded-2xl bg-gray-50 p-4">

            <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
              Business Address
            </p>

            <p className="mt-1 text-xs font-semibold text-gray-700">
              {seller.address ||
                "Address not provided"}
              {seller.city
                ? `, ${seller.city}`
                : ""}
              {seller.state
                ? `, ${seller.state}`
                : ""}
              {seller.pincode
                ? ` - ${seller.pincode}`
                : ""}
            </p>

          </div>

          <p className="mt-3 break-all text-[9px] text-gray-400">
            Seller ID:{" "}
            {seller.id}
          </p>

        </div>

        {/* ACTIONS */}

        <div className="flex shrink-0 flex-col gap-3 xl:w-52">

          {seller.status ===
            "pending" && (
            <>
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onApprove
                }
                className="rounded-xl bg-green-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {processing
                  ? "Processing..."
                  : "✓ Approve Seller"}
              </button>

              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onReject
                }
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-600 disabled:opacity-50"
              >
                Reject Application
              </button>
            </>
          )}

          {seller.status ===
            "approved" && (
            <button
              type="button"
              disabled={
                processing
              }
              onClick={
                onBlock
              }
              className="rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {processing
                ? "Processing..."
                : "Block Seller"}
            </button>
          )}

          {seller.status ===
            "rejected" && (
            <>
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onApprove
                }
                className="rounded-xl bg-green-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
              >
                {processing
                  ? "Processing..."
                  : "Approve Seller"}
              </button>
            </>
          )}

          {seller.status ===
            "blocked" && (
            <button
              type="button"
              disabled={
                processing
              }
              onClick={
                onUnblock
              }
              className="rounded-xl bg-black px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {processing
                ? "Processing..."
                : "Unblock Seller"}
            </button>
          )}

        </div>

      </div>
    </div>
  );
}

/* =========================================================
   DOCUMENT BOX
========================================================= */

function DocumentBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 break-all text-xs font-bold text-gray-700">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   INFO BADGE
========================================================= */

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10px] font-bold text-gray-600">
      {children}
    </span>
  );
}

/* =========================================================
   VERIFICATION BADGE
========================================================= */

function VerificationBadge({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
        verified
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {verified
        ? "✓"
        : "○"}{" "}
      {label}
    </span>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function SellerStatusBadge({
  status,
}: {
  status: SellerStatus;
}) {
  const styles: Record<
    SellerStatus,
    string
  > = {
    pending:
      "bg-yellow-100 text-yellow-700",

    approved:
      "bg-green-100 text-green-700",

    rejected:
      "bg-red-100 text-red-700",

    blocked:
      "bg-gray-200 text-gray-700",
  };

  const labels: Record<
    SellerStatus,
    string
  > = {
    pending: "PENDING",

    approved: "APPROVED",

    rejected: "REJECTED",

    blocked: "BLOCKED",
  };

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
