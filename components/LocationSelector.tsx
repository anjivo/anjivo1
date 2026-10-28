
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type SavedAddress = {
  id: string;
  label: "Home" | "Work" | "Other";
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

type AddressForm = {
  label: "Home" | "Work" | "Other";
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
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
};

const STORAGE_KEY = "anjivo-selected-address";

export default function LocationSelector() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selected, setSelected] = useState<SavedAddress | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoggedIn(Boolean(user));
    });

    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        setSelected(JSON.parse(stored) as SavedAddress);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!open || !auth.currentUser) return;

    let cancelled = false;

    async function loadAddresses() {
      const user = auth.currentUser;
      if (!user) return;

      setLoading(true);
      setError("");

      try {
        const token = await user.getIdToken();

        const response = await fetch("/api/account/addresses", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Addresses load nahi ho sake."
          );
        }

        if (cancelled) return;

        const items = Array.isArray(result.addresses)
          ? (result.addresses as SavedAddress[])
          : [];

        setAddresses(items);

        const stored = localStorage.getItem(STORAGE_KEY);
        let preferred: SavedAddress | undefined;

        if (stored) {
          try {
            const saved = JSON.parse(stored) as SavedAddress;
            preferred = items.find((item) => item.id === saved.id);
          } catch {
            // Ignore invalid locally stored data.
          }
        }

        preferred ??= items.find((item) => item.isDefault);

        if (preferred) {
          setSelected(preferred);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(preferred));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Addresses load nahi ho sake."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAddresses();

    return () => {
      cancelled = true;
    };
  }, [open, loggedIn]);

  function chooseAddress(address: SavedAddress) {
    setSelected(address);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(address));
    window.dispatchEvent(new Event("anjivo-address-changed"));
    setOpen(false);
    setShowForm(false);
    setError("");
  }

  function updateField<K extends keyof AddressForm>(
    key: K,
    value: AddressForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function useCurrentLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError("Is browser mein GPS location available nahi hai.");
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const url = new URL(
            "https://nominatim.openstreetmap.org/reverse"
          );

          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("lat", String(latitude));
          url.searchParams.set("lon", String(longitude));

          const response = await fetch(url.toString());

          if (!response.ok) {
            throw new Error("Address lookup failed.");
          }

          const result = await response.json();
          const a = result.address ?? {};

          setForm((current) => ({
            ...current,
            addressLine1: [
              a.house_number,
              a.road,
              a.neighbourhood,
              a.suburb,
            ]
              .filter(Boolean)
              .join(", ")
              .slice(0, 200),
            addressLine2: a.village || a.landmark || "",
            city:
              a.city ||
              a.town ||
              a.village ||
              a.county ||
              "",
            state: a.state || "",
            pincode: String(a.postcode || "")
              .replace(/\D/g, "")
              .slice(0, 6),
          }));

          setShowForm(true);
        } catch {
          setError(
            "Address nahi mil saka. Aap manually address enter karein."
          );
          setShowForm(true);
        } finally {
          setGpsLoading(false);
        }
      },
      (geoError) => {
        setGpsLoading(false);

        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission allow karein ya address manually enter karein."
            : "Current location nahi mil saki. Address manually enter karein."
        );

        setShowForm(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }

  async function saveAddress() {
    setError("");

    if (!auth.currentUser) {
      setError("Address save karne ke liye pehle login karein.");
      return;
    }

    if (
      form.fullName.trim().length < 2 ||
      !/^[6-9]\d{9}$/.test(form.phone.trim()) ||
      form.addressLine1.trim().length < 5 ||
      form.city.trim().length < 2 ||
      form.state.trim().length < 2 ||
      !/^\d{6}$/.test(form.pincode.trim())
    ) {
      setError(
        "Naam, 10-digit mobile, poora address, city, state aur 6-digit PIN code sahi bharein."
      );
      return;
    }

    setLoading(true);

    try {
      const token = await auth.currentUser.getIdToken();

      const response = await fetch("/api/account/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          isDefault: addresses.length === 0,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.address) {
        throw new Error(
          result.message || "Address save nahi ho saka."
        );
      }

      const address = result.address as SavedAddress;

      setAddresses((current) => [...current, address]);
      chooseAddress(address);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Address save nahi ho saka."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="hidden shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-left transition hover:border-gray-400 lg:block"
      >
        <div className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
          Deliver to
        </div>

        <div className="mt-0.5 max-w-44 truncate text-xs font-bold text-gray-800">
          📍 {selected?.pincode || "Select Location"}
        </div>

        {selected && (
          <div className="max-w-44 truncate text-[10px] text-gray-500">
            {selected.city}, {selected.state}
          </div>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="location-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Select Delivery Location
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Apna delivery address choose karein.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg px-3 py-1 text-xl text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => void useCurrentLocation()}
              disabled={gpsLoading}
              className="mt-5 w-full rounded-xl border border-gray-300 p-4 text-left font-semibold hover:bg-gray-50 disabled:opacity-60"
            >
              📍 {gpsLoading
                ? "Location detect ho rahi hai..."
                : "Use my current location"}
              <span className="mt-1 block text-xs font-normal text-gray-500">
                GPS permission ki zarurat hogi.
              </span>
            </button>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {!loggedIn ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                Saved addresses use karne ke liye{" "}
                <a
                  href="/login"
                  className="font-bold underline"
                >
                  login karein
                </a>
                . Aapko login ke baad yahan wapas aana hoga.
              </div>
            ) : (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">
                    Your saved addresses
                  </h3>

                  <button
                    type="button"
                    onClick={() => {
                      setForm(EMPTY_FORM);
                      setShowForm(true);
                      setError("");
                    }}
                    className="text-sm font-bold text-blue-700"
                  >
                    + Add new
                  </button>
                </div>

                {loading && (
                  <p className="py-4 text-sm text-gray-500">
                    Loading addresses...
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => chooseAddress(address)}
                      className={`w-full rounded-xl border p-3 text-left ${
                        selected?.id === address.id
                          ? "border-black bg-gray-50"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-900">
                          {address.label} · {address.fullName}
                        </span>

                        {selected?.id === address.id && (
                          <span className="text-xs font-bold">
                            Selected ✓
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-600">
                        {address.addressLine1}
                        {address.addressLine2
                          ? `, ${address.addressLine2}`
                          : ""}
                        , {address.city}, {address.state} -{" "}
                        {address.pincode}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {address.phone}
                      </p>
                    </button>
                  ))}

                  {!loading && addresses.length === 0 && (
                    <p className="py-3 text-sm text-gray-500">
                      Abhi koi saved address nahi hai.
                    </p>
                  )}
                </div>

                {showForm && (
                  <div className="mt-5 space-y-3 border-t border-gray-200 pt-4">
                    <h3 className="font-bold text-gray-900">
                      Add delivery address
                    </h3>

                    <label className="block text-sm font-medium">
                      Save address as
                      <select
                        value={form.label}
                        onChange={(e) =>
                          updateField(
                            "label",
                            e.target.value as AddressForm["label"]
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 p-3"
                      >
                        <option value="Home">Home</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>

                    {(
                      [
                        ["fullName", "Full name"],
                        ["phone", "10-digit mobile number"],
                        ["addressLine1", "House / Street / Area"],
                        ["addressLine2", "Landmark (optional)"],
                        ["city", "City / District"],
                        ["state", "State"],
                        ["pincode", "6-digit PIN code"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="block text-sm font-medium text-gray-700"
                      >
                        {label}
                        <input
                          value={form[key]}
                          onChange={(e) => {
                            let value = e.target.value;

                            if (key === "phone") {
                              value = value.replace(/\D/g, "").slice(0, 10);
                            }

                            if (key === "pincode") {
                              value = value.replace(/\D/g, "").slice(0, 6);
                            }

                            updateField(key, value);
                          }}
                          maxLength={
                            key === "phone"
                              ? 10
                              : key === "pincode"
                                ? 6
                                : undefined
                          }
                          autoComplete="off"
                          className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-black"
                          placeholder={label}
                        />
                      </label>
                    ))}

                    <button
                      type="button"
                      onClick={() => void saveAddress()}
                      disabled={loading || gpsLoading}
                      className="w-full rounded-xl bg-black px-4 py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save and select address"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
