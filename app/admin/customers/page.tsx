"use client";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";

import {
  getAllCustomers,
  updateCustomerStatus,
  type AdminCustomer,
} from "@/lib/admin-customers";

export default function AdminCustomersPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<User | null>(null);

  const [customers, setCustomers] =
    useState<AdminCustomer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<
      | "all"
      | "retail"
      | "wholesale"
      | "blocked"
    >("all");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          if (!currentUser) {
            router.replace("/login");
            return;
          }

          setUser(currentUser);

          try {
            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  currentUser.uid
                )
              );

            if (
              !userSnapshot.exists() ||
              userSnapshot.data().role !==
                "ADMIN"
            ) {
              router.replace("/");
              return;
            }

            await loadCustomers();
          } catch (err) {
            console.error(err);

            setError(
              "Unable to verify admin access."
            );
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getAllCustomers();

      setCustomers(data);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load customers."
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(
    customer: AdminCustomer
  ) {
    const newStatus =
      customer.accountStatus ===
      "blocked"
        ? "active"
        : "blocked";

    try {
      setActionLoading(
        customer.id
      );

      setError("");
      setSuccess("");

      await updateCustomerStatus(
        customer.id,
        newStatus
      );

      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id
            ? {
                ...item,
                accountStatus:
                  newStatus,
              }
            : item
        )
      );

      setSuccess(
        newStatus === "blocked"
          ? "Customer blocked successfully."
          : "Customer activated successfully."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to update customer status."
      );
    } finally {
      setActionLoading("");
    }
  }

  const filteredCustomers =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return customers.filter(
        (customer) => {
          const searchable = [
            customer.name,
            customer.email,
            customer.phone,
            customer.uid,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !term ||
            searchable.includes(
              term
            );

          let matchesFilter = true;

          if (filter === "retail") {
            matchesFilter =
              customer.role ===
              "RETAIL_CUSTOMER";
          }

          if (filter === "wholesale") {
            matchesFilter =
              customer.role ===
              "WHOLESALE_CUSTOMER";
          }

          if (filter === "blocked") {
            matchesFilter =
              customer.accountStatus ===
              "blocked";
          }

          return (
            matchesSearch &&
            matchesFilter
          );
        }
      );
    }, [
      customers,
      search,
      filter,
    ]);

  const retailCount =
    customers.filter(
      (customer) =>
        customer.role ===
        "RETAIL_CUSTOMER"
    ).length;

  const wholesaleCount =
    customers.filter(
      (customer) =>
        customer.role ===
        "WHOLESALE_CUSTOMER"
    ).length;

  const blockedCount =
    customers.filter(
      (customer) =>
        customer.accountStatus ===
        "blocked"
    ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading customers...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ANJIVO ADMIN
            </p>

            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Customer Management
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadCustomers}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Refresh
            </button>

            <button
              onClick={() =>
                router.push("/admin")
              }
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Dashboard
            </button>
          </div>

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* STATS */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total Customers"
            value={customers.length}
          />

          <StatCard
            title="Retail Customers"
            value={retailCount}
          />

          <StatCard
            title="Wholesale Customers"
            value={wholesaleCount}
          />

          <StatCard
            title="Blocked"
            value={blockedCount}
          />

        </div>

        {/* FILTER */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search name, email, phone or customer ID..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 lg:max-w-xl"
            />

            <div className="flex flex-wrap gap-2">

              <FilterButton
                active={
                  filter === "all"
                }
                onClick={() =>
                  setFilter("all")
                }
              >
                All
              </FilterButton>

              <FilterButton
                active={
                  filter === "retail"
                }
                onClick={() =>
                  setFilter("retail")
                }
              >
                Retail
              </FilterButton>

              <FilterButton
                active={
                  filter === "wholesale"
                }
                onClick={() =>
                  setFilter(
                    "wholesale"
                  )
                }
              >
                Wholesale
              </FilterButton>

              <FilterButton
                active={
                  filter === "blocked"
                }
                onClick={() =>
                  setFilter("blocked")
                }
              >
                Blocked
              </FilterButton>

            </div>
          </div>
        </section>

        {/* CUSTOMER LIST */}

        <section className="mt-6 space-y-4">

          {filteredCustomers.length ===
          0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">

              <h2 className="text-lg font-bold text-slate-900">
                No customers found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Try another search or filter.
              </p>

            </div>
          ) : (
            filteredCustomers.map(
              (customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  loading={
                    actionLoading ===
                    customer.id
                  }
                  onToggle={() =>
                    toggleStatus(
                      customer
                    )
                  }
                  onView={() =>
                    router.push(
                      `/admin/customers/${customer.id}`
                    )
                  }
                />
              )
            )
          )}

        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function CustomerCard({
  customer,
  loading,
  onToggle,
  onView,
}: {
  customer: AdminCustomer;
  loading: boolean;
  onToggle: () => void;
  onView: () => void;
}) {
  const isWholesale =
    customer.role ===
    "WHOLESALE_CUSTOMER";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <h2 className="text-lg font-bold text-slate-900">
              {customer.name ||
                "Unnamed Customer"}
            </h2>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isWholesale
                  ? "bg-purple-50 text-purple-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {isWholesale
                ? "Wholesale"
                : "Retail"}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                customer.accountStatus ===
                "blocked"
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {customer.accountStatus ===
              "blocked"
                ? "Blocked"
                : "Active"}
            </span>

          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <Info
              label="Email"
              value={
                customer.email ||
                "-"
              }
            />

            <Info
              label="Phone"
              value={
                customer.phone ||
                "-"
              }
            />

            <Info
              label="Customer ID"
              value={
                customer.uid
              }
            />

            <Info
              label="Role"
              value={
                customer.role
              }
            />

          </div>
        </div>

        <div className="flex flex-wrap gap-2">

          <button
            onClick={onView}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            View
          </button>

          <button
            disabled={loading}
            onClick={onToggle}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              customer.accountStatus ===
              "blocked"
                ? "bg-green-600"
                : "bg-red-600"
            }`}
          >
            {loading
              ? "Updating..."
              : customer.accountStatus ===
                "blocked"
              ? "Activate"
              : "Block"}
          </button>

        </div>
      </div>
    </article>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}
