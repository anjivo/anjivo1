
"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

type PartnerStatus = "active" | "inactive";

type DeliveryPartner = {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  serviceArea: string;
  status: PartnerStatus;
  createdAt: string | null;
};

type PartnerForm = {
  name: string;
  phone: string;
  email: string;
  temporaryPassword: string;
  vehicleType: string;
  serviceArea: string;
};

const EMPTY_FORM: PartnerForm = {
  name: "",
  phone: "",
  email: "",
  temporaryPassword: "",
  vehicleType: "bike",
  serviceArea: "",
};

async function apiRequest(
  url: string,
  options: RequestInit = {}
) {
  const user = getAuth().currentUser;

  if (!user) {
    throw new Error("Please login with your admin account.");
  }

  const token = await user.getIdToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Something went wrong.");
  }

  return result;
}

export default function DeliveryPartnersPage() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [filter, setFilter] = useState<"all" | PartnerStatus>("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(
        "/api/admin/delivery-partners"
      );

      setPartners(result.partners ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load delivery partners."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setError("Please login with your admin account.");
        setLoading(false);
        return;
      }

      void loadPartners();
    });

    return unsubscribe;
  }, [loadPartners]);

  function updateField(
    field: keyof PartnerForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/api/admin/delivery-partners",
        {
          method: "POST",
          body: JSON.stringify(form),
        }
      );

      setPartners((previous) => [
        result.partner,
        ...previous.filter(
          (partner) => partner.id !== result.partner.id
        ),
      ]);

      setForm(EMPTY_FORM);
      setMessage(
        "Partner added successfully. Status: Inactive. Verify the partner before activating their account."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create partner."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(partner: DeliveryPartner) {
    const nextStatus: PartnerStatus =
      partner.status === "active" ? "inactive" : "active";

    setUpdatingId(partner.id);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        "/api/admin/delivery-partners",
        {
          method: "PATCH",
          body: JSON.stringify({
            partnerId: partner.id,
            status: nextStatus,
          }),
        }
      );

      setPartners((previous) =>
        previous.map((item) =>
          item.id === partner.id ? result.partner : item
        )
      );

      setMessage(
        `${partner.name} is now ${nextStatus}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update partner."
      );
    } finally {
      setUpdatingId("");
    }
  }

  const filteredPartners = partners.filter((partner) =>
    filter === "all" ? true : partner.status === filter
  );

  const activeCount = partners.filter(
    (partner) => partner.status === "active"
  ).length;

  const inactiveCount = partners.length - activeCount;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          ANJIVO Logistics
        </p>

        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          Delivery Partners
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Register, verify and manage your delivery team.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total partners" value={partners.length} />
        <StatCard label="Active partners" value={activeCount} />
        <StatCard label="Inactive partners" value={inactiveCount} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-xl font-bold text-gray-900">
          Add delivery partner
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          New partners remain inactive until verified.
        </p>

        <form
          onSubmit={handleCreate}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <FormField label="Full name">
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(e) =>
                updateField("name", e.target.value)
              }
              placeholder="Partner full name"
              className={inputClass}
            />
          </FormField>

          <FormField label="Phone number">
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(e) =>
                updateField("phone", e.target.value)
              }
              placeholder="Mobile number"
              className={inputClass}
            />
          </FormField>

          <FormField label="Login email">
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                updateField("email", e.target.value)
              }
              placeholder="partner@example.com"
              className={inputClass}
            />
          </FormField>

          <FormField label="Temporary login password">
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={form.temporaryPassword}
              onChange={(e) =>
                updateField("temporaryPassword", e.target.value)
              }
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </FormField>

          <FormField label="Vehicle type">
            <select
              value={form.vehicleType}
              onChange={(e) =>
                updateField("vehicleType", e.target.value)
              }
              className={inputClass}
            >
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
              <option value="van">Van</option>
              <option value="other">Other</option>
            </select>
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Service area / PIN codes">
              <input
                required
                maxLength={160}
                value={form.serviceArea}
                onChange={(e) =>
                  updateField("serviceArea", e.target.value)
                }
                placeholder="e.g. Ghazipur city, 233001"
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add delivery partner"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Partner directory
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {filteredPartners.length} partner(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "active", "inactive"] as const).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    filter === value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {value === "all"
                    ? "All"
                    : value === "active"
                      ? "Active"
                      : "Inactive"}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => void loadPartners()}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-gray-500">
            Loading delivery partners...
          </p>
        ) : filteredPartners.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-medium text-gray-700">
              No delivery partners found.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Add your first partner using the form above.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Partner</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Service area</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">
                        {partner.name}
                      </p>
                      <p className="mt-1 text-gray-500">
                        {partner.phone}
                      </p>
                      {partner.email && (
                        <p className="mt-1 text-xs text-gray-500">
                          {partner.email}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4 capitalize text-gray-700">
                      {partner.vehicleType}
                    </td>

                    <td className="px-4 py-4 text-gray-700">
                      {partner.serviceArea}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          partner.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {partner.status}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={updatingId === partner.id}
                        onClick={() => void toggleStatus(partner)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                          partner.status === "active"
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {updatingId === partner.id
                          ? "Updating..."
                          : partner.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
