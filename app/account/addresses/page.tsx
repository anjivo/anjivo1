
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AddressLabel = "Home" | "Work" | "Other";

type SavedAddress = {
  id: string;
  label: AddressLabel;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AddressForm = {
  label: AddressLabel;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

const EMPTY_FORM: AddressForm = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: true,
};

type ApiResult = {
  success?: boolean;
  message?: string;
  addresses?: SavedAddress[];
  address?: SavedAddress;
};

export default function AddressesPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadAddresses = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");

    try {
      const token = await currentUser.getIdToken();

      const response = await fetch("/api/account/addresses", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Saved addresses load nahi ho sake."
        );
      }

      setAddresses(
        Array.isArray(result.addresses) ? result.addresses : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Saved addresses load nahi ho sake."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      return;
    }

    void loadAddresses(user);
  }, [user, loadAddresses]);

  function updateForm<K extends keyof AddressForm>(
    field: K,
    value: AddressForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startAddAddress() {
    setEditingId("");
    setForm({
      ...EMPTY_FORM,
      isDefault: addresses.length === 0,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEditAddress(address: SavedAddress) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId("");
    setForm({ ...EMPTY_FORM });
    setError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      router.push("/login?redirect=/account/addresses");
      return;
    }

    const phone = form.phone.trim();
    const pincode = form.pincode.trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Valid 10-digit Indian mobile number enter karein.");
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      setError("Valid 6-digit PIN code enter karein.");
      return;
    }

    if (form.fullName.trim().length < 2) {
      setError("Full name enter karein.");
      return;
    }

    if (form.addressLine1.trim().length < 5) {
      setError("Complete delivery address enter karein.");
      return;
    }

    if (form.city.trim().length < 2 || form.state.trim().length < 2) {
      setError("Valid city aur state enter karein.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const token = await user.getIdToken();

      const payload = {
        ...(editingId ? { id: editingId } : {}),
        label: form.label,
        fullName: form.fullName.trim(),
        phone,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode,
        isDefault: form.isDefault,
      };

      const response = await fetch("/api/account/addresses", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Address save nahi ho paya."
        );
      }

      setNotice(
        editingId
          ? "Address successfully update ho gaya."
          : "Address successfully add ho gaya."
      );

      setFormOpen(false);
      setEditingId("");
      setForm({ ...EMPTY_FORM });

      await loadAddresses(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Address save nahi ho paya. Dobara try karein."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(address: SavedAddress) {
    if (!user) {
      router.push("/login?redirect=/account/addresses");
      return;
    }

    const confirmed = window.confirm(
      `Kya aap "${address.label}" address delete karna chahte hain?`
    );

    if (!confirmed) return;

    setDeletingId(address.id);
    setError("");
    setNotice("");

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        `/api/account/addresses?id=${encodeURIComponent(address.id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Address delete nahi ho paya."
        );
      }

      setAddresses((current) =>
        current.filter((item) => item.id !== address.id)
      );
      setNotice("Address successfully delete ho gaya.");

      await loadAddresses(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Address delete nahi ho paya."
      );
    } finally {
      setDeletingId("");
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-center text-gray-600">
          Loading account...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-4xl">📍</div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Saved Addresses
          </h1>
          <p className="mt-2 text-gray-600">
            Apne delivery addresses manage karne ke liye login karein.
          </p>
          <button
            type="button"
            onClick={() =>
              router.push("/login?redirect=/account/addresses")
            }
            className="mt-6 rounded-lg bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800"
          >
            Login to Continue
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.push("/account")}
          className="mb-5 text-sm font-medium text-gray-600 hover:text-black"
        >
          ← Back to My Account
        </button>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Saved Addresses
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Apne delivery addresses add aur manage karein.
            </p>
          </div>

          <button
            type="button"
            onClick={startAddAddress}
            disabled={addresses.length >= 10 || formOpen}
            className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add New Address
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
            {error.toLowerCase().includes("verify") && (
              <p className="mt-2">
                Apne account ka email aur phone verification complete karein.
              </p>
            )}
          </div>
        )}

        {notice && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {notice}
          </p>
        )}

        {formOpen && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? "Edit Address" : "Add New Address"}
              </h2>

              <button
                type="button"
                onClick={cancelForm}
                disabled={saving}
                aria-label="Close address form"
                className="rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label
                  htmlFor="addressLabel"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Address label
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {(["Home", "Work", "Other"] as AddressLabel[]).map(
                    (label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => updateForm("label", label)}
                        className={`rounded-lg border px-3 py-3 text-sm font-semibold ${
                          form.label === label
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {label === "Home"
                          ? "🏠 Home"
                          : label === "Work"
                            ? "🏢 Work"
                            : "📍 Other"}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Full name *
                  </label>
                  <input
                    id="fullName"
                    value={form.fullName}
                    onChange={(event) =>
                      updateForm("fullName", event.target.value)
                    }
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                    placeholder="Recipient name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Mobile number *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(event) =>
                      updateForm(
                        "phone",
                        event.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    autoComplete="tel-national"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="addressLine1"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Address line 1 *
                </label>
                <input
                  id="addressLine1"
                  value={form.addressLine1}
                  onChange={(event) =>
                    updateForm("addressLine1", event.target.value)
                  }
                  minLength={5}
                  maxLength={200}
                  autoComplete="address-line1"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                  placeholder="House no., street, area"
                />
              </div>

              <div>
                <label
                  htmlFor="addressLine2"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Address line 2 (optional)
                </label>
                <input
                  id="addressLine2"
                  value={form.addressLine2}
                  onChange={(event) =>
                    updateForm("addressLine2", event.target.value)
                  }
                  maxLength={200}
                  autoComplete="address-line2"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                  placeholder="Landmark, apartment, locality"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="city"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    City *
                  </label>
                  <input
                    id="city"
                    value={form.city}
                    onChange={(event) =>
                      updateForm("city", event.target.value)
                    }
                    minLength={2}
                    maxLength={100}
                    autoComplete="address-level2"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label
                    htmlFor="state"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    State *
                  </label>
                  <input
                    id="state"
                    value={form.state}
                    onChange={(event) =>
                      updateForm("state", event.target.value)
                    }
                    minLength={2}
                    maxLength={100}
                    autoComplete="address-level1"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pincode"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    PIN code *
                  </label>
                  <input
                    id="pincode"
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={(event) =>
                      updateForm(
                        "pincode",
                        event.target.value.replace(/\D/g, "").slice(0, 6)
                      )
                    }
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="postal-code"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                    placeholder="6-digit PIN"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    updateForm("isDefault", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-black"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    Set as default address
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Default address ko delivery ke liye pehle use kiya ja sakta hai.
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Save Address"}
                </button>

                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Your Addresses
            </h2>
            <span className="text-sm text-gray-500">
              {addresses.length}/10 saved
            </span>
          </div>

          {loading && (
            <div className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-600">
              Loading saved addresses...
            </div>
          )}

          {!loading && addresses.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <div className="text-4xl">📍</div>
              <h3 className="mt-3 text-lg font-bold text-gray-900">
                No saved addresses yet
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Apna delivery address save karein, taaki checkout aasaan ho.
              </p>
              {!formOpen && (
                <button
                  type="button"
                  onClick={startAddAddress}
                  className="mt-5 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Add Your First Address
                </button>
              )}
            </div>
          )}

          {!loading && addresses.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addresses.map((address) => (
                <article
                  key={address.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {address.label === "Home"
                          ? "🏠"
                          : address.label === "Work"
                            ? "🏢"
                            : "📍"}
                      </span>
                      <h3 className="font-bold text-gray-900">
                        {address.label}
                      </h3>
                    </div>

                    {address.isDefault && (
                      <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-1 text-sm">
                    <p className="font-semibold text-gray-900">
                      {address.fullName}
                    </p>
                    <p className="text-gray-600">{address.phone}</p>
                    <p className="break-words text-gray-600">
                      {address.addressLine1}
                    </p>
                    {address.addressLine2 && (
                      <p className="break-words text-gray-600">
                        {address.addressLine2}
                      </p>
                    )}
                    <p className="text-gray-600">
                      {address.city}, {address.state} - {address.pincode}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => startEditAddress(address)}
                      disabled={formOpen || deletingId !== ""}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(address)}
                      disabled={deletingId !== "" || saving}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === address.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {addresses.length >= 10 && (
            <p className="mt-4 text-sm text-gray-500">
              Aap maximum 10 addresses save kar sakte hain. Naya address add
              karne se pehle kisi existing address ko delete karein.
            </p>
          )}
        </section>

        <p className="mt-8 text-xs text-gray-500">
          Address save karne ke liye aapka account active hona chahiye aur
          email aur mobile verification complete honi chahiye.
        </p>
      </div>
    </main>
  );
}
