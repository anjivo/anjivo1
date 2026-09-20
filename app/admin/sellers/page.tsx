"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "@/lib/firebase";

type Seller = {
  id: string;
  userId: string;
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;

  businessType?: string;
  category?: string;

  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  gstNumber?: string;
  panNumber?: string;

  bankAccountName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;

  status?: string;
  sellerVerified?: boolean;

  emailVerified?: boolean;
  phoneVerified?: boolean;
  gstVerified?: boolean;
  panVerified?: boolean;
  bankVerified?: boolean;

  adminApproved?: boolean;
  accountStatus?: string;

  createdAt?: {
    seconds?: number;
  };
};

type FilterType =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "blocked";

export default function AdminSellersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/admin/sellers");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists()) {
          router.replace("/");
          return;
        }

        const userData = userSnap.data();

        if (userData.role !== "ADMIN") {
          router.replace("/");
          return;
        }

        setAuthorized(true);
        await loadSellers();
      } catch (err) {
        console.error(err);
        setError("Admin access verify nahi ho saka.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function loadSellers() {
    setLoadingSellers(true);
    setError("");

    try {
      const sellersQuery = query(
        collection(db, "sellers"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(sellersQuery);

      const sellerList: Seller[] = snapshot.docs.map((sellerDoc) => ({
        id: sellerDoc.id,
        ...(sellerDoc.data() as Omit<Seller, "id">),
      }));

      setSellers(sellerList);
    } catch (err) {
      console.error(err);
      setError(
        "Seller applications load nahi ho paayi. Firestore index ya permissions check karein."
      );
    } finally {
      setLoadingSellers(false);
    }
  }

  const filteredSellers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sellers.filter((seller) => {
      const status = seller.status?.toLowerCase() || "pending";

      const matchesFilter =
        filter === "all" ||
        status === filter;

      if (!matchesFilter) return false;

      if (!searchText) return true;

      return (
        seller.businessName?.toLowerCase().includes(searchText) ||
        seller.ownerName?.toLowerCase().includes(searchText) ||
        seller.email?.toLowerCase().includes(searchText) ||
        seller.phone?.toLowerCase().includes(searchText) ||
        seller.city?.toLowerCase().includes(searchText)
      );
    });
  }, [sellers, filter, search]);

  const stats = useMemo(() => {
    return {
      total: sellers.length,
      pending: sellers.filter(
        (seller) => seller.status === "pending"
      ).length,
      approved: sellers.filter(
        (seller) => seller.status === "approved"
      ).length,
      rejected: sellers.filter(
        (seller) => seller.status === "rejected"
      ).length,
      blocked: sellers.filter(
        (seller) => seller.status === "blocked"
      ).length,
    };
  }, [sellers]);

  async function approveSeller() {
    if (!selectedSeller) return;

    const confirmed = window.confirm(
      `Approve seller "${selectedSeller.businessName || selectedSeller.ownerName}"?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const sellerRef = doc(db, "sellers", selectedSeller.userId);
      const userRef = doc(db, "users", selectedSeller.userId);

      await updateDoc(sellerRef, {
        status: "approved",
        sellerVerified: true,
        adminApproved: true,
        accountStatus: "ACTIVE",
        updatedAt: new Date(),
      });

      await updateDoc(userRef, {
        role: "SELLER",
        accountStatus: "ACTIVE",
        sellerApplicationStatus: "APPROVED",
        updatedAt: new Date(),
      });

      setMessage("Seller successfully approved.");

      setSelectedSeller(null);

      await loadSellers();
    } catch (err) {
      console.error(err);
      setError(
        "Seller approve nahi ho saka. Firestore rules aur admin account check karein."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectSeller() {
    if (!selectedSeller) return;

    const confirmed = window.confirm(
      `Reject seller "${selectedSeller.businessName || selectedSeller.ownerName}"?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const sellerRef = doc(db, "sellers", selectedSeller.userId);
      const userRef = doc(db, "users", selectedSeller.userId);

      await updateDoc(sellerRef, {
        status: "rejected",
        sellerVerified: false,
        adminApproved: false,
        accountStatus: "REJECTED",
        updatedAt: new Date(),
      });

      await updateDoc(userRef, {
        sellerApplicationStatus: "REJECTED",
        accountStatus: "REJECTED",
        updatedAt: new Date(),
      });

      setMessage("Seller application rejected.");

      setSelectedSeller(null);

      await loadSellers();
    } catch (err) {
      console.error(err);
      setError("Seller reject nahi ho saka.");
    } finally {
      setActionLoading(false);
    }
  }

  async function blockSeller() {
    if (!selectedSeller) return;

    const confirmed = window.confirm(
      `Block seller "${selectedSeller.businessName || selectedSeller.ownerName}"?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const sellerRef = doc(db, "sellers", selectedSeller.userId);
      const userRef = doc(db, "users", selectedSeller.userId);

      await updateDoc(sellerRef, {
        status: "blocked",
        sellerVerified: false,
        adminApproved: false,
        accountStatus: "BLOCKED",
        updatedAt: new Date(),
      });

      await updateDoc(userRef, {
        accountStatus: "BLOCKED",
        updatedAt: new Date(),
      });

      setMessage("Seller blocked successfully.");

      setSelectedSeller(null);

      await loadSellers();
    } catch (err) {
      console.error(err);
      setError("Seller block nahi ho saka.");
    } finally {
      setActionLoading(false);
    }
  }

  async function restoreSeller() {
    if (!selectedSeller) return;

    const confirmed = window.confirm(
      `Restore seller "${selectedSeller.businessName || selectedSeller.ownerName}"?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const sellerRef = doc(db, "sellers", selectedSeller.userId);
      const userRef = doc(db, "users", selectedSeller.userId);

      await updateDoc(sellerRef, {
        status: "approved",
        sellerVerified: true,
        adminApproved: true,
        accountStatus: "ACTIVE",
        updatedAt: new Date(),
      });

      await updateDoc(userRef, {
        role: "SELLER",
        accountStatus: "ACTIVE",
        sellerApplicationStatus: "APPROVED",
        updatedAt: new Date(),
      });

      setMessage("Seller restored successfully.");

      setSelectedSeller(null);

      await loadSellers();
    } catch (err) {
      console.error(err);
      setError("Seller restore nahi ho saka.");
    } finally {
      setActionLoading(false);
    }
  }

  function statusBadge(status?: string) {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";

      case "rejected":
        return "bg-red-100 text-red-700";

      case "blocked":
        return "bg-gray-200 text-gray-700";

      default:
        return "bg-yellow-100 text-yellow-700";
    }
  }

  function formatStatus(status?: string) {
    if (!status) return "Pending";

    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function maskAccountNumber(account?: string) {
    if (!account) return "Not provided";

    if (account.length <= 4) return account;

    return "••••••" + account.slice(-4);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-black animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">
            Admin panel loading...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto object-contain"
            />

            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Seller Management
              </h1>

              <p className="text-xs text-gray-500">
                Admin Seller Applications
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Admin Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* MESSAGES */}
        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* STATS */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard
            title="Total"
            value={stats.total}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          />

          <StatCard
            title="Approved"
            value={stats.approved}
            active={filter === "approved"}
            onClick={() => setFilter("approved")}
          />

          <StatCard
            title="Rejected"
            value={stats.rejected}
            active={filter === "rejected"}
            onClick={() => setFilter("rejected")}
          />

          <StatCard
            title="Blocked"
            value={stats.blocked}
            active={filter === "blocked"}
            onClick={() => setFilter("blocked")}
          />
        </section>

        {/* SEARCH */}
        <section className="bg-white border rounded-2xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Search business, owner, email, phone or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />

            <button
              onClick={loadSellers}
              disabled={loadingSellers}
              className="rounded-xl bg-black text-white px-5 py-3 font-semibold disabled:opacity-50"
            >
              {loadingSellers ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>

        {/* SELLER LIST */}
        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-bold text-gray-900">
              Seller Applications
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              {filteredSellers.length} application(s)
            </p>
          </div>

          {loadingSellers ? (
            <div className="p-10 text-center text-gray-500">
              Loading sellers...
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">📋</div>

              <h3 className="font-semibold text-gray-900">
                No seller applications
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                Selected filter ke according koi seller nahi mila.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSellers.map((seller) => (
                <div
                  key={seller.id}
                  className="p-5 hover:bg-gray-50 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-gray-900">
                          {seller.businessName || "Business Name Not Provided"}
                        </h3>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(
                            seller.status
                          )}`}
                        >
                          {formatStatus(seller.status)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mt-2">
                        Owner:{" "}
                        <span className="font-medium">
                          {seller.ownerName || "—"}
                        </span>
                      </p>

                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 mt-1">
                        <span>{seller.phone || "No phone"}</span>
                        <span>{seller.email || "No email"}</span>
                        <span>
                          {seller.city || "—"},{" "}
                          {seller.state || "—"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedSeller(seller)}
                      className="shrink-0 rounded-xl bg-black text-white px-5 py-3 text-sm font-semibold hover:opacity-90"
                    >
                      Review Application
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* DETAIL MODAL */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* MODAL HEADER */}
              <div className="border-b px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    Seller Application
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    {selectedSeller.businessName || "Business"}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedSeller(null)}
                  className="h-9 w-9 rounded-full border hover:bg-gray-50"
                >
                  ×
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* BASIC DETAILS */}
                <DetailSection title="Business Information">
                  <Detail
                    label="Business Name"
                    value={selectedSeller.businessName}
                  />

                  <Detail
                    label="Owner Name"
                    value={selectedSeller.ownerName}
                  />

                  <Detail
                    label="Business Type"
                    value={selectedSeller.businessType}
                  />

                  <Detail
                    label="Category"
                    value={selectedSeller.category}
                  />

                  <Detail
                    label="Email"
                    value={selectedSeller.email}
                  />

                  <Detail
                    label="Phone"
                    value={selectedSeller.phone}
                  />
                </DetailSection>

                {/* ADDRESS */}
                <DetailSection title="Business Address">
                  <div className="md:col-span-2">
                    <Detail
                      label="Address"
                      value={selectedSeller.address}
                    />
                  </div>

                  <Detail
                    label="City"
                    value={selectedSeller.city}
                  />

                  <Detail
                    label="State"
                    value={selectedSeller.state}
                  />

                  <Detail
                    label="Pincode"
                    value={selectedSeller.pincode}
                  />
                </DetailSection>

                {/* KYC */}
                <DetailSection title="KYC / Tax Information">
                  <Detail
                    label="GST Number"
                    value={selectedSeller.gstNumber}
                  />

                  <Detail
                    label="GST Verification"
                    value={
                      selectedSeller.gstVerified
                        ? "Verified"
                        : "Pending"
                    }
                    verified={selectedSeller.gstVerified}
                  />

                  <Detail
                    label="PAN Number"
                    value={selectedSeller.panNumber}
                  />

                  <Detail
                    label="PAN Verification"
                    value={
                      selectedSeller.panVerified
                        ? "Verified"
                        : "Pending"
                    }
                    verified={selectedSeller.panVerified}
                  />
                </DetailSection>

                {/* BANK */}
                <DetailSection title="Bank Information">
                  <Detail
                    label="Account Name"
                    value={selectedSeller.bankAccountName}
                  />

                  <Detail
                    label="Account Number"
                    value={maskAccountNumber(
                      selectedSeller.bankAccountNumber
                    )}
                  />

                  <Detail
                    label="IFSC"
                    value={selectedSeller.ifscCode}
                  />

                  <Detail
                    label="Bank Verification"
                    value={
                      selectedSeller.bankVerified
                        ? "Verified"
                        : "Pending"
                    }
                    verified={selectedSeller.bankVerified}
                  />
                </DetailSection>

                {/* VERIFICATION */}
                <DetailSection title="Verification Status">
                  <VerificationItem
                    label="Email"
                    verified={selectedSeller.emailVerified}
                  />

                  <VerificationItem
                    label="Mobile"
                    verified={selectedSeller.phoneVerified}
                  />

                  <VerificationItem
                    label="GST"
                    verified={selectedSeller.gstVerified}
                  />

                  <VerificationItem
                    label="PAN"
                    verified={selectedSeller.panVerified}
                  />

                  <VerificationItem
                    label="Bank"
                    verified={selectedSeller.bankVerified}
                  />
                </DetailSection>

                {/* CURRENT STATUS */}
                <div className="rounded-xl bg-gray-50 border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">
                        Current Application Status
                      </p>

                      <p className="font-bold text-gray-900 mt-1">
                        {formatStatus(selectedSeller.status)}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusBadge(
                        selectedSeller.status
                      )}`}
                    >
                      {formatStatus(selectedSeller.status)}
                    </span>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="border-t pt-5">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Admin Actions
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {selectedSeller.status !== "approved" && (
                      <button
                        onClick={approveSeller}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-green-600 text-white px-4 py-3 font-semibold disabled:opacity-50"
                      >
                        {actionLoading
                          ? "Processing..."
                          : "✓ Approve Seller"}
                      </button>
                    )}

                    {selectedSeller.status !== "rejected" && (
                      <button
                        onClick={rejectSeller}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-red-600 text-white px-4 py-3 font-semibold disabled:opacity-50"
                      >
                        {actionLoading
                          ? "Processing..."
                          : "✕ Reject"}
                      </button>
                    )}

                    {selectedSeller.status !== "blocked" && (
                      <button
                        onClick={blockSeller}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-gray-800 text-white px-4 py-3 font-semibold disabled:opacity-50"
                      >
                        {actionLoading
                          ? "Processing..."
                          : "Block Seller"}
                      </button>
                    )}

                    {selectedSeller.status === "blocked" && (
                      <button
                        onClick={restoreSeller}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-green-600 text-white px-4 py-3 font-semibold disabled:opacity-50"
                      >
                        {actionLoading
                          ? "Processing..."
                          : "Restore Seller"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  <strong>Important:</strong> Seller approval ke baad
                  hi seller ko ANJIVO marketplace par seller role aur
                  product-management access milega.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  active,
  onClick,
}: {
  title: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 transition ${
        active
          ? "bg-black text-white border-black"
          : "bg-white hover:bg-gray-50"
      }`}
    >
      <p
        className={`text-xs ${
          active ? "text-gray-300" : "text-gray-500"
        }`}
      >
        {title}
      </p>

      <p className="text-2xl font-bold mt-1">{value}</p>
    </button>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-bold text-gray-900 mb-3">
        {title}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {children}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  verified,
}: {
  label: string;
  value?: string;
  verified?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>

      <p
        className={`text-sm font-semibold mt-1 ${
          verified === true
            ? "text-green-700"
            : "text-gray-900"
        }`}
      >
        {value || "Not provided"}
      </p>
    </div>
  );
}

function VerificationItem({
  label,
  verified,
}: {
  label: string;
  verified?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <span className="text-sm font-medium text-gray-700">
        {label}
      </span>

      {verified ? (
        <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
          ✓ Verified
        </span>
      ) : (
        <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full">
          Pending
        </span>
      )}
    </div>
  );
}
