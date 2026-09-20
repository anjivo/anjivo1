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

type CustomerRole =
  | "RETAIL_CUSTOMER"
  | "WHOLESALE_CUSTOMER";

type AccountStatus =
  | "ACTIVE"
  | "PENDING_VERIFICATION"
  | "BLOCKED"
  | "SUSPENDED"
  | "REJECTED";

type Customer = {
  id: string;
  uid: string;

  name: string;
  email: string;
  phone: string;

  role: CustomerRole;

  emailVerified: boolean;
  phoneVerified: boolean;

  accountStatus: AccountStatus;

  photoURL: string;

  customerType: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis ===
      "function"
  ) {
    return (
      value as { toMillis: () => number }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const time = new Date(value).getTime();

    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

function formatDate(value: unknown): string {
  const millis = timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(millis));
}

function mapCustomer(
  id: string,
  data: Record<string, unknown>
): Customer | null {
  const role =
    data.role === "WHOLESALE_CUSTOMER"
      ? "WHOLESALE_CUSTOMER"
      : data.role === "RETAIL_CUSTOMER"
      ? "RETAIL_CUSTOMER"
      : null;

  if (!role) return null;

  const accountStatus =
    data.accountStatus ===
      "PENDING_VERIFICATION" ||
    data.accountStatus === "BLOCKED" ||
    data.accountStatus === "SUSPENDED" ||
    data.accountStatus === "REJECTED"
      ? data.accountStatus
      : "ACTIVE";

  return {
    id,

    uid:
      stringValue(data.uid) || id,

    name:
      stringValue(data.name) ||
      stringValue(data.displayName) ||
      "Unnamed Customer",

    email: stringValue(data.email),

    phone:
      stringValue(data.phone) ||
      stringValue(data.mobile),

    role,

    emailVerified: booleanValue(
      data.emailVerified
    ),

    phoneVerified: booleanValue(
      data.phoneVerified
    ),

    accountStatus,

    photoURL:
      stringValue(data.photoURL),

    customerType:
      stringValue(data.customerType) ||
      role,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] =
    useState(false);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [search, setSearch] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState<
      "all" | CustomerRole
    >("all");

  const [statusFilter, setStatusFilter] =
    useState<
      "all" | AccountStatus
    >("all");

  const [verificationFilter, setVerificationFilter] =
    useState<
      "all" | "verified" | "unverified"
    >("all");

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/customers";
            return;
          }

          try {
            const userSnap =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (!userSnap.exists()) {
              window.location.href = "/";
              return;
            }

            const userData =
              userSnap.data();

            if (
              userData.role !==
              "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadCustomers();
          } catch (error) {
            console.error(
              "Admin authorization error:",
              error
            );

            window.location.href = "/";
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, []);

  async function loadCustomers() {
    try {
      const snapshot =
        await getDocs(
          collection(db, "users")
        );

      const list: Customer[] = [];

      snapshot.docs.forEach(
        (item) => {
          const customer =
            mapCustomer(
              item.id,
              item.data()
            );

          if (customer) {
            list.push(customer);
          }
        }
      );

      list.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      setCustomers(list);
    } catch (error) {
      console.error(
        "Load customers error:",
        error
      );

      alert(
        "Customers load nahi ho paaye. Firestore rules check karein."
      );
    }
  }

  const filteredCustomers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return customers.filter(
        (customer) => {
          const matchesSearch =
            !query ||
            customer.name
              .toLowerCase()
              .includes(query) ||
            customer.email
              .toLowerCase()
              .includes(query) ||
            customer.phone
              .toLowerCase()
              .includes(query) ||
            customer.uid
              .toLowerCase()
              .includes(query);

          const matchesRole =
            roleFilter === "all" ||
            customer.role ===
              roleFilter;

          const matchesStatus =
            statusFilter === "all" ||
            customer.accountStatus ===
              statusFilter;

          const fullyVerified =
            customer.emailVerified &&
            customer.phoneVerified;

          const matchesVerification =
            verificationFilter ===
              "all" ||
            (verificationFilter ===
              "verified" &&
              fullyVerified) ||
            (verificationFilter ===
              "unverified" &&
              !fullyVerified);

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus &&
            matchesVerification
          );
        }
      );
    }, [
      customers,
      search,
      roleFilter,
      statusFilter,
      verificationFilter,
    ]);

  const stats = useMemo(() => {
    const total =
      customers.length;

    const retail =
      customers.filter(
        (item) =>
          item.role ===
          "RETAIL_CUSTOMER"
      ).length;

    const wholesale =
      customers.filter(
        (item) =>
          item.role ===
          "WHOLESALE_CUSTOMER"
      ).length;

    const active =
      customers.filter(
        (item) =>
          item.accountStatus ===
          "ACTIVE"
      ).length;

    const pending =
      customers.filter(
        (item) =>
          item.accountStatus ===
          "PENDING_VERIFICATION"
      ).length;

    const blocked =
      customers.filter(
        (item) =>
          item.accountStatus ===
          "BLOCKED"
      ).length;

    const suspended =
      customers.filter(
        (item) =>
          item.accountStatus ===
          "SUSPENDED"
      ).length;

    const verified =
      customers.filter(
        (item) =>
          item.emailVerified &&
          item.phoneVerified
      ).length;

    return {
      total,
      retail,
      wholesale,
      active,
      pending,
      blocked,
      suspended,
      verified,
    };
  }, [customers]);

  async function updateAccountStatus(
    customer: Customer,
    status: AccountStatus
  ) {
    const actionLabel =
      status === "BLOCKED"
        ? "block"
        : status === "ACTIVE"
        ? "activate"
        : status === "SUSPENDED"
        ? "suspend"
        : "update";

    const confirmed =
      window.confirm(
        `Kya aap ${customer.name} ka account ${actionLabel} karna chahte hain?`
      );

    if (!confirmed) return;

    setSaving(true);

    try {
      await updateDoc(
        doc(
          db,
          "users",
          customer.uid
        ),
        {
          accountStatus: status,
          updatedAt:
            serverTimestamp(),
        }
      );

      await loadCustomers();

      if (
        selectedCustomer?.uid ===
        customer.uid
      ) {
        setSelectedCustomer({
          ...customer,
          accountStatus: status,
        });
      }
    } catch (error) {
      console.error(
        "Update customer status error:",
        error
      );

      alert(
        "Customer status update nahi ho saka."
      );
    } finally {
      setSaving(false);
    }
  }

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

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="shrink-0"
            >
              <img
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="hidden border-l pl-4 sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin Panel
              </p>

              <h1 className="text-lg font-bold text-slate-900">
                Customers
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Admin Home
            </Link>

            <button
              onClick={loadCustomers}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-indigo-600">
            Users & Customers
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Customer Management
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Retail aur wholesale customers ke accounts,
            verification aur account status ko centrally manage karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Total"
            value={stats.total}
            icon="👥"
          />

          <StatCard
            label="Retail"
            value={stats.retail}
            icon="🛒"
          />

          <StatCard
            label="Wholesale"
            value={stats.wholesale}
            icon="📦"
          />

          <StatCard
            label="Active"
            value={stats.active}
            icon="🟢"
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            icon="🟡"
          />

          <StatCard
            label="Blocked"
            value={stats.blocked}
            icon="🚫"
          />

          <StatCard
            label="Suspended"
            value={stats.suspended}
            icon="⏸️"
          />

          <StatCard
            label="Verified"
            value={stats.verified}
            icon="✓"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_190px_190px_200px_auto]">
              <SearchBox
                value={search}
                onChange={setSearch}
              />

              <SelectBox
                value={roleFilter}
                onChange={(value) =>
                  setRoleFilter(
                    value as
                      | "all"
                      | CustomerRole
                  )
                }
                options={[
                  ["all", "All Customers"],
                  [
                    "RETAIL_CUSTOMER",
                    "Retail",
                  ],
                  [
                    "WHOLESALE_CUSTOMER",
                    "Wholesale",
                  ],
                ]}
              />

              <SelectBox
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as
                      | "all"
                      | AccountStatus
                  )
                }
                options={[
                  ["all", "All Status"],
                  ["ACTIVE", "Active"],
                  [
                    "PENDING_VERIFICATION",
                    "Pending",
                  ],
                  [
                    "BLOCKED",
                    "Blocked",
                  ],
                  [
                    "SUSPENDED",
                    "Suspended",
                  ],
                  [
                    "REJECTED",
                    "Rejected",
                  ],
                ]}
              />

              <SelectBox
                value={
                  verificationFilter
                }
                onChange={(value) =>
                  setVerificationFilter(
                    value as
                      | "all"
                      | "verified"
                      | "unverified"
                  )
                }
                options={[
                  ["all", "All Verification"],
                  [
                    "verified",
                    "Fully Verified",
                  ],
                  [
                    "unverified",
                    "Not Fully Verified",
                  ],
                ]}
              />

              <button
                onClick={loadCustomers}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {filteredCustomers.length ===
          0 ? (
            <EmptyState
              title="No customers found"
              description={
                customers.length === 0
                  ? "Abhi users collection mein koi retail ya wholesale customer nahi mila."
                  : "Current filters ke according koi customer nahi mila."
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCustomers.map(
                (customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    onOpen={() =>
                      setSelectedCustomer(
                        customer
                      )
                    }
                    onBlock={() =>
                      updateAccountStatus(
                        customer,
                        "BLOCKED"
                      )
                    }
                    onActivate={() =>
                      updateAccountStatus(
                        customer,
                        "ACTIVE"
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      {selectedCustomer && (
        <CustomerDetailsModal
          customer={
            selectedCustomer
          }
          saving={saving}
          onClose={() =>
            setSelectedCustomer(
              null
            )
          }
          onBlock={() =>
            updateAccountStatus(
              selectedCustomer,
              "BLOCKED"
            )
          }
          onActivate={() =>
            updateAccountStatus(
              selectedCustomer,
              "ACTIVE"
            )
          }
          onSuspend={() =>
            updateAccountStatus(
              selectedCustomer,
              "SUSPENDED"
            )
          }
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {value.toLocaleString(
              "en-IN"
            )}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        🔎
      </span>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder="Search name, email, mobile, UID..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
    >
      {options.map(
        ([optionValue, label]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {label}
          </option>
        )
      )}
    </select>
  );
}

function CustomerRow({
  customer,
  onOpen,
  onBlock,
  onActivate,
}: {
  customer: Customer;
  onOpen: () => void;
  onBlock: () => void;
  onActivate: () => void;
}) {
  const fullyVerified =
    customer.emailVerified &&
    customer.phoneVerified;

  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <Avatar
            name={customer.name}
            photoURL={
              customer.photoURL
            }
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {customer.name}
              </h3>

              <AccountStatusBadge
                status={
                  customer.accountStatus
                }
              />

              <RoleBadge
                role={
                  customer.role
                }
              />

              {fullyVerified && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  ✓ Verified
                </span>
              )}
            </div>

            <div className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
              <span>
                ✉️{" "}
                {customer.email ||
                  "Email not available"}
              </span>

              <span>
                📱{" "}
                {customer.phone ||
                  "Mobile not available"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <InfoBadge
                label={
                  customer.role ===
                  "WHOLESALE_CUSTOMER"
                    ? "Wholesale Customer"
                    : "Retail Customer"
                }
              />

              <InfoBadge
                label={`Joined ${formatDate(
                  customer.createdAt
                )}`}
              />

              <InfoBadge
                label={`UID: ${customer.uid}`}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            onClick={onOpen}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            👁 View
          </button>

          {customer.accountStatus ===
          "BLOCKED" ? (
            <button
              onClick={onActivate}
              className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              ✓ Activate
            </button>
          ) : (
            <button
              onClick={onBlock}
              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              🚫 Block
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  name,
  photoURL,
}: {
  name: string;
  photoURL: string;
}) {
  const initial =
    name.trim().charAt(0).toUpperCase() ||
    "U";

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-bold text-white">
      {photoURL ? (
        <img
          src={photoURL}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </div>
  );
}

function RoleBadge({
  role,
}: {
  role: CustomerRole;
}) {
  const wholesale =
    role === "WHOLESALE_CUSTOMER";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        wholesale
          ? "bg-indigo-100 text-indigo-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {wholesale
        ? "Wholesale"
        : "Retail"}
    </span>
  );
}

function AccountStatusBadge({
  status,
}: {
  status: AccountStatus;
}) {
  const styles: Record<
    AccountStatus,
    string
  > = {
    ACTIVE:
      "bg-emerald-100 text-emerald-700",
    PENDING_VERIFICATION:
      "bg-amber-100 text-amber-700",
    BLOCKED:
      "bg-red-100 text-red-700",
    SUSPENDED:
      "bg-orange-100 text-orange-700",
    REJECTED:
      "bg-red-100 text-red-700",
  };

  const labels: Record<
    AccountStatus,
    string
  > = {
    ACTIVE: "Active",
    PENDING_VERIFICATION:
      "Pending",
    BLOCKED: "Blocked",
    SUSPENDED: "Suspended",
    REJECTED: "Rejected",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function InfoBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="max-w-full rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
      {label}
    </span>
  );
}

function CustomerDetailsModal({
  customer,
  saving,
  onClose,
  onBlock,
  onActivate,
  onSuspend,
}: {
  customer: Customer;
  saving: boolean;
  onClose: () => void;
  onBlock: () => void;
  onActivate: () => void;
  onSuspend: () => void;
}) {
  const fullyVerified =
    customer.emailVerified &&
    customer.phoneVerified;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Avatar
              name={customer.name}
              photoURL={
                customer.photoURL
              }
            />

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Customer Profile
              </p>

              <h2 className="text-xl font-bold text-slate-900">
                {customer.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge
                role={customer.role}
              />

              <AccountStatusBadge
                status={
                  customer.accountStatus
                }
              />

              {fullyVerified && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  ✓ Fully Verified
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCard
                label="Full Name"
                value={customer.name}
              />

              <DetailCard
                label="Email"
                value={
                  customer.email ||
                  "Not available"
                }
              />

              <DetailCard
                label="Mobile"
                value={
                  customer.phone ||
                  "Not available"
                }
              />

              <DetailCard
                label="Customer Type"
                value={
                  customer.role ===
                  "WHOLESALE_CUSTOMER"
                    ? "Wholesale Customer"
                    : "Retail Customer"
                }
              />

              <DetailCard
                label="Account Status"
                value={
                  customer.accountStatus
                }
              />

              <DetailCard
                label="Joined"
                value={formatDate(
                  customer.createdAt
                )}
              />

              <DetailCard
                label="Email Verification"
                value={
                  customer.emailVerified
                    ? "Verified"
                    : "Not Verified"
                }
              />

              <DetailCard
                label="Mobile Verification"
                value={
                  customer.phoneVerified
                    ? "Verified"
                    : "Not Verified"
                }
              />

              <DetailCard
                label="User ID"
                value={customer.uid}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Account Actions
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {customer.accountStatus !==
                  "ACTIVE" && (
                  <button
                    onClick={
                      onActivate
                    }
                    disabled={saving}
                    className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                  >
                    ✓ Activate
                  </button>
                )}

                {customer.accountStatus !==
                  "BLOCKED" && (
                  <button
                    onClick={onBlock}
                    disabled={saving}
                    className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                  >
                    🚫 Block
                  </button>
                )}

                {customer.accountStatus !==
                  "SUSPENDED" && (
                  <button
                    onClick={
                      onSuspend
                    }
                    disabled={saving}
                    className="rounded-xl bg-orange-100 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                  >
                    ⏸ Suspend
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                Security
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-700">
                Customer ka password, Firebase Auth credentials
                ya role is page se directly modify nahi kiya ja raha.
                Account status changes ko Firestore security rules
                se admin-only enforce karna zaroori hai.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        👥
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
