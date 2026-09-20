"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  limit,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type AuditLog = {
  id: string;
  action: string;
  actionType: string;
  category: string;
  description: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  targetId: string;
  targetType: string;
  targetName: string;
  orderId: string;
  sellerId: string;
  customerId: string;
  productId: string;
  oldValue: string;
  newValue: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
  createdAt?: unknown;
};

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : "";
}

function timestampValue(
  value: unknown
): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed =
      new Date(value).getTime();

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function formatDate(
  value: unknown
): string {
  const time =
    timestampValue(value);

  if (!time) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(time));
}

function mapAuditLog(
  id: string,
  data: Record<string, unknown>
): AuditLog {
  return {
    id,

    action:
      stringValue(data.action) ||
      "unknown",

    actionType:
      stringValue(
        data.actionType
      ) || "OTHER",

    category:
      stringValue(
        data.category
      ) || "OTHER",

    description:
      stringValue(
        data.description
      ),

    actorId:
      stringValue(
        data.actorId
      ) ||
      stringValue(
        data.userId
      ),

    actorName:
      stringValue(
        data.actorName
      ) ||
      stringValue(
        data.userName
      ),

    actorEmail:
      stringValue(
        data.actorEmail
      ) ||
      stringValue(
        data.email
      ),

    actorRole:
      stringValue(
        data.actorRole
      ) ||
      stringValue(
        data.role
      ),

    targetId:
      stringValue(
        data.targetId
      ),

    targetType:
      stringValue(
        data.targetType
      ),

    targetName:
      stringValue(
        data.targetName
      ),

    orderId:
      stringValue(
        data.orderId
      ),

    sellerId:
      stringValue(
        data.sellerId
      ),

    customerId:
      stringValue(
        data.customerId
      ),

    productId:
      stringValue(
        data.productId
      ),

    oldValue:
      stringValue(
        data.oldValue
      ),

    newValue:
      stringValue(
        data.newValue
      ),

    ipAddress:
      stringValue(
        data.ipAddress
      ),

    userAgent:
      stringValue(
        data.userAgent
      ),

    metadata:
      typeof data.metadata ===
        "object" &&
      data.metadata !== null
        ? (
            data.metadata as Record<
              string,
              unknown
            >
          )
        : {},

    createdAt:
      data.createdAt,
  };
}

export default function AdminAuditLogsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [logs, setLogs] =
    useState<AuditLog[]>([]);

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [actionFilter, setActionFilter] =
    useState("all");

  const [roleFilter, setRoleFilter] =
    useState("all");

  const [dateFilter, setDateFilter] =
    useState("all");

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(
      null
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/audit-logs";
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

            if (
              !userSnap.exists() ||
              userSnap.data().role !==
                "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadLogs();
          } catch (error) {
            console.error(
              "Audit authorization error:",
              error
            );

            window.location.href =
              "/";
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  async function loadLogs() {
    try {
      /*
       * Intentionally no orderBy(createdAt) here.
       * Older audit documents may not contain createdAt.
       */
      const logsQuery =
        query(
          collection(
            db,
            "auditLogs"
          ),
          limit(1000)
        );

      const snapshot =
        await getDocs(
          logsQuery
        );

      const list =
        snapshot.docs.map(
          (item) =>
            mapAuditLog(
              item.id,
              item.data()
            )
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

      setLogs(list);
    } catch (error) {
      console.error(
        "Load audit logs error:",
        error
      );

      alert(
        "Audit logs load nahi ho paaye. Firestore rules/collection check karein."
      );
    }
  }

  const categories =
    useMemo(() => {
      return Array.from(
        new Set(
          logs
            .map(
              (item) =>
                item.category
            )
            .filter(Boolean)
        )
      ).sort();
    }, [logs]);

  const actions =
    useMemo(() => {
      return Array.from(
        new Set(
          logs
            .map(
              (item) =>
                item.action
            )
            .filter(Boolean)
        )
      ).sort();
    }, [logs]);

  const filteredLogs =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      const now =
        Date.now();

      return logs.filter(
        (log) => {
          const searchMatch =
            !q ||
            log.id
              .toLowerCase()
              .includes(q) ||
            log.action
              .toLowerCase()
              .includes(q) ||
            log.category
              .toLowerCase()
              .includes(q) ||
            log.description
              .toLowerCase()
              .includes(q) ||
            log.actorName
              .toLowerCase()
              .includes(q) ||
            log.actorEmail
              .toLowerCase()
              .includes(q) ||
            log.actorId
              .toLowerCase()
              .includes(q) ||
            log.targetId
              .toLowerCase()
              .includes(q) ||
            log.targetName
              .toLowerCase()
              .includes(q) ||
            log.orderId
              .toLowerCase()
              .includes(q) ||
            log.sellerId
              .toLowerCase()
              .includes(q) ||
            log.productId
              .toLowerCase()
              .includes(q);

          const categoryMatch =
            categoryFilter ===
              "all" ||
            log.category ===
              categoryFilter;

          const actionMatch =
            actionFilter ===
              "all" ||
            log.action ===
              actionFilter;

          const roleMatch =
            roleFilter ===
              "all" ||
            log.actorRole ===
              roleFilter;

          const logTime =
            timestampValue(
              log.createdAt
            );

          let dateMatch =
            true;

          if (
            dateFilter ===
            "today"
          ) {
            const today =
              new Date();

            const start =
              new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
              ).getTime();

            dateMatch =
              logTime >= start;
          }

          if (
            dateFilter ===
            "7days"
          ) {
            dateMatch =
              logTime >=
              now -
                7 *
                  24 *
                  60 *
                  60 *
                  1000;
          }

          if (
            dateFilter ===
            "30days"
          ) {
            dateMatch =
              logTime >=
              now -
                30 *
                  24 *
                  60 *
                  60 *
                  1000;
          }

          return (
            searchMatch &&
            categoryMatch &&
            actionMatch &&
            roleMatch &&
            dateMatch
          );
        }
      );
    }, [
      logs,
      search,
      categoryFilter,
      actionFilter,
      roleFilter,
      dateFilter,
    ]);

  const stats =
    useMemo(() => {
      const today =
        new Date();

      const todayStart =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ).getTime();

      const todayCount =
        logs.filter(
          (log) =>
            timestampValue(
              log.createdAt
            ) >= todayStart
        ).length;

      const adminActions =
        logs.filter(
          (log) =>
            log.actorRole ===
            "ADMIN"
        ).length;

      const sellerActions =
        logs.filter(
          (log) =>
            log.actorRole ===
            "SELLER"
        ).length;

      const orderActions =
        logs.filter(
          (log) =>
            log.category ===
            "ORDER"
        ).length;

      const securityActions =
        logs.filter(
          (log) =>
            log.category ===
            "SECURITY"
        ).length;

      return {
        total:
          logs.length,

        today:
          todayCount,

        adminActions,

        sellerActions,

        orderActions,

        securityActions,
      };
    }, [logs]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading audit logs...
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
            <Link href="/admin">
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
                Security & Audit Logs
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin"
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Dashboard
            </Link>

            <button
              onClick={loadLogs}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            Platform Security
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Audit Trail
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            ANJIVO par hone wale important administrative,
            seller, order, payment aur security actions ka
            centralized history.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Logs"
            value={stats.total}
            icon="📋"
          />

          <StatCard
            label="Today"
            value={stats.today}
            icon="🕐"
          />

          <StatCard
            label="Admin Actions"
            value={stats.adminActions}
            icon="👤"
          />

          <StatCard
            label="Seller Actions"
            value={stats.sellerActions}
            icon="🏪"
          />

          <StatCard
            label="Order Actions"
            value={stats.orderActions}
            icon="🛒"
          />

          <StatCard
            label="Security"
            value={stats.securityActions}
            icon="🔐"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_170px_200px_170px_150px_auto]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔎
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search action, admin, seller, order, product..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Categories
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {formatLabel(
                        category
                      )}
                    </option>
                  )
                )}
              </select>

              <select
                value={actionFilter}
                onChange={(event) =>
                  setActionFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Actions
                </option>

                {actions.map(
                  (action) => (
                    <option
                      key={action}
                      value={action}
                    >
                      {formatLabel(
                        action
                      )}
                    </option>
                  )
                )}
              </select>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Roles
                </option>

                <option value="ADMIN">
                  Admin
                </option>

                <option value="SELLER">
                  Seller
                </option>

                <option value="RETAIL_CUSTOMER">
                  Retail Customer
                </option>

                <option value="WHOLESALE_CUSTOMER">
                  Wholesale Customer
                </option>

                <option value="">
                  Unknown
                </option>
              </select>

              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Dates
                </option>

                <option value="today">
                  Today
                </option>

                <option value="7days">
                  Last 7 Days
                </option>

                <option value="30days">
                  Last 30 Days
                </option>
              </select>

              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter(
                    "all"
                  );
                  setActionFilter(
                    "all"
                  );
                  setRoleFilter(
                    "all"
                  );
                  setDateFilter(
                    "all"
                  );
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">
              Showing{" "}
              <span className="font-bold text-slate-900">
                {filteredLogs.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900">
                {logs.length}
              </span>{" "}
              audit records
            </p>
          </div>

          {filteredLogs.length ===
          0 ? (
            <EmptyState
              title="No audit logs found"
              description={
                logs.length === 0
                  ? "Abhi auditLogs collection mein koi record nahi mila."
                  : "Current filters ke according koi audit record nahi mila."
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map(
                (log) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    onOpen={() =>
                      setSelectedLog(
                        log
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-bold text-red-900">
            Audit Log Security
          </h3>

          <p className="mt-1 text-xs leading-5 text-red-800">
            Audit logs ko client-side create/update/delete karne
            ki permission nahi deni chahiye. Production mein
            trusted server/Admin backend se immutable audit record
            create karna chahiye. Admin UI sirf read access rakhe.
          </p>
        </section>
      </div>

      {selectedLog && (
        <AuditDetailsModal
          log={selectedLog}
          onClose={() =>
            setSelectedLog(null)
          }
        />
      )}
    </main>
  );
}

function formatLabel(
  value: string
): string {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
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

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function AuditRow({
  log,
  onOpen,
}: {
  log: AuditLog;
  onOpen: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">
              {formatLabel(
                log.actionType
              )}
            </span>

            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
              {formatLabel(
                log.category
              )}
            </span>

            <span className="font-mono text-[10px] text-slate-400">
              {log.id}
            </span>
          </div>

          <div className="mt-2">
            <p className="text-sm font-bold text-slate-900">
              {formatLabel(
                log.action
              )}
            </p>

            {log.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                {log.description}
              </p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Actor:{" "}
              <strong className="text-slate-700">
                {log.actorName ||
                  log.actorEmail ||
                  "Unknown"}
              </strong>
            </span>

            {log.targetName && (
              <span>
                Target:{" "}
                <strong className="text-slate-700">
                  {log.targetName}
                </strong>
              </span>
            )}

            {log.orderId && (
              <span className="font-mono">
                Order: #
                {log.orderId}
              </span>
            )}

            {log.productId && (
              <span className="font-mono">
                Product:{" "}
                {log.productId}
              </span>
            )}

            <span>
              {formatDate(
                log.createdAt
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 xl:justify-end">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Role
            </p>

            <p className="text-xs font-bold text-slate-700">
              {formatLabel(
                log.actorRole ||
                  "UNKNOWN"
              )}
            </p>
          </div>

          <button
            onClick={onOpen}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditDetailsModal({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Audit Record
            </p>

            <h2 className="mt-1 font-mono text-lg font-bold text-slate-900">
              #{log.id}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                {formatLabel(
                  log.action
                )}
              </span>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                {formatLabel(
                  log.category
                )}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {formatLabel(
                  log.actorRole ||
                    "UNKNOWN"
                )}
              </span>
            </div>

            {log.description && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {log.description}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCard
                label="Actor Name"
                value={
                  log.actorName ||
                  "—"
                }
              />

              <DetailCard
                label="Actor Email"
                value={
                  log.actorEmail ||
                  "—"
                }
              />

              <DetailCard
                label="Actor UID"
                value={
                  log.actorId ||
                  "—"
                }
              />

              <DetailCard
                label="Target Type"
                value={
                  log.targetType ||
                  "—"
                }
              />

              <DetailCard
                label="Target ID"
                value={
                  log.targetId ||
                  "—"
                }
              />

              <DetailCard
                label="Target Name"
                value={
                  log.targetName ||
                  "—"
                }
              />

              <DetailCard
                label="Order ID"
                value={
                  log.orderId ||
                  "—"
                }
              />

              <DetailCard
                label="Seller ID"
                value={
                  log.sellerId ||
                  "—"
                }
              />

              <DetailCard
                label="Customer ID"
                value={
                  log.customerId ||
                  "—"
                }
              />

              <DetailCard
                label="Product ID"
                value={
                  log.productId ||
                  "—"
                }
              />

              <DetailCard
                label="Created At"
                value={formatDate(
                  log.createdAt
                )}
              />

              <DetailCard
                label="IP Address"
                value={
                  log.ipAddress ||
                  "Not recorded"
                }
              />
            </div>

            {(log.oldValue ||
              log.newValue) && (
              <div className="grid gap-4 md:grid-cols-2">
                <ValuePanel
                  title="Previous Value"
                  value={
                    log.oldValue
                  }
                />

                <ValuePanel
                  title="New Value"
                  value={
                    log.newValue
                  }
                />
              </div>
            )}

            {Object.keys(
              log.metadata
            ).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Metadata
                </p>

                <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">
                  {JSON.stringify(
                    log.metadata,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {log.userAgent && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  User Agent
                </p>

                <p className="mt-2 break-all text-xs leading-5 text-slate-600">
                  {log.userAgent}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
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

      <p className="mt-1 break-all text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function ValuePanel({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">
        {value}
      </pre>
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
        🔐
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
