"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

type BusinessType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "LLP"
  | "PRIVATE_LIMITED";

type SellerProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;

  businessName: string;
  ownerName: string;

  businessType: BusinessType;

  category: string;

  address: string;
  city: string;
  state: string;
  pincode: string;

  gstNumber: string;
  panNumber: string;

  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;

  sellerStatus: string;
  sellerVerified: boolean;
};

export default function SellerProfilePage() {
  const router = useRouter();

  /* =========================================================
     STATE
  ========================================================= */

  const [sellerId, setSellerId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =========================================================
     FORM
  ========================================================= */

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [businessName, setBusinessName] =
    useState("");

  const [ownerName, setOwnerName] =
    useState("");

  const [businessType, setBusinessType] =
    useState<BusinessType>("INDIVIDUAL");

  const [category, setCategory] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [city, setCity] =
    useState("");

  const [state, setState] =
    useState("");

  const [pincode, setPincode] =
    useState("");

  const [gstNumber, setGstNumber] =
    useState("");

  const [panNumber, setPanNumber] =
    useState("");

  const [bankAccountName, setBankAccountName] =
    useState("");

  const [bankAccountNumber, setBankAccountNumber] =
    useState("");

  const [ifscCode, setIfscCode] =
    useState("");

  /* =========================================================
     SELLER STATUS
  ========================================================= */

  const [sellerStatus, setSellerStatus] =
    useState("pending");

  const [sellerVerified, setSellerVerified] =
    useState(false);

  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/seller/profile"
            );
            return;
          }

          try {
            setError("");

            setSellerId(user.uid);

            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const sellerRef = doc(
              db,
              "sellers",
              user.uid
            );

            const [
              userSnapshot,
              sellerSnapshot,
            ] = await Promise.all([
              getDoc(userRef),
              getDoc(sellerRef),
            ]);

            if (!userSnapshot.exists()) {
              setError(
                "Seller profile not found."
              );
              setLoading(false);
              return;
            }

            const userData =
              userSnapshot.data();

            if (
              userData.role !== "SELLER"
            ) {
              setError(
                "Seller access required."
              );
              setLoading(false);
              return;
            }

            /* =================================================
               USER INFORMATION
            ================================================= */

            setName(
              String(
                userData.name ??
                  user.displayName ??
                  ""
              )
            );

            setEmail(
              String(
                userData.email ??
                  user.email ??
                  ""
              )
            );

            setPhone(
              String(
                userData.phone ?? ""
              )
            );

            /* =================================================
               SELLER INFORMATION
            ================================================= */

            if (
              sellerSnapshot.exists()
            ) {
              const data =
                sellerSnapshot.data();

              setBusinessName(
                String(
                  data.businessName ??
                    ""
                )
              );

              setOwnerName(
                String(
                  data.ownerName ??
                    userData.name ??
                    ""
                )
              );

              setBusinessType(
                data.businessType ??
                  "INDIVIDUAL"
              );

              setCategory(
                String(
                  data.category ?? ""
                )
              );

              setAddress(
                String(
                  data.address ?? ""
                )
              );

              setCity(
                String(
                  data.city ?? ""
                )
              );

              setState(
                String(
                  data.state ?? ""
                )
              );

              setPincode(
                String(
                  data.pincode ?? ""
                )
              );

              setGstNumber(
                String(
                  data.gstNumber ?? ""
                )
              );

              setPanNumber(
                String(
                  data.panNumber ?? ""
                )
              );

              setBankAccountName(
                String(
                  data.bankAccountName ??
                    ""
                )
              );

              setBankAccountNumber(
                String(
                  data.bankAccountNumber ??
                    ""
                )
              );

              setIfscCode(
                String(
                  data.ifscCode ?? ""
                )
              );

              setSellerStatus(
                String(
                  data.status ??
                    data.sellerStatus ??
                    userData.sellerStatus ??
                    "pending"
                )
              );

              setSellerVerified(
                data.sellerVerified ===
                  true
              );
            } else {
              setSellerStatus(
                String(
                  userData.sellerStatus ??
                    "pending"
                )
              );
            }
          } catch (err) {
            console.error(
              "Seller profile loading error:",
              err
            );

            setError(
              "Unable to load seller profile."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  /* =========================================================
     VALIDATION
  ========================================================= */

  function validate() {
    if (!name.trim()) {
      return "Name is required.";
    }

    if (!email.trim()) {
      return "Email is required.";
    }

    if (!phone.trim()) {
      return "Phone number is required.";
    }

    if (
      phone.replace(
        /\D/g,
        ""
      ).length !== 10
    ) {
      return "Enter a valid 10-digit phone number.";
    }

    if (!businessName.trim()) {
      return "Business name is required.";
    }

    if (!ownerName.trim()) {
      return "Owner name is required.";
    }

    if (!category.trim()) {
      return "Business category is required.";
    }

    if (!address.trim()) {
      return "Business address is required.";
    }

    if (!city.trim()) {
      return "City is required.";
    }

    if (!state.trim()) {
      return "State is required.";
    }

    if (
      !/^\d{6}$/.test(
        pincode.trim()
      )
    ) {
      return "Enter a valid 6-digit pincode.";
    }

    if (
      gstNumber.trim() &&
      !/^[0-9A-Z]{15}$/i.test(
        gstNumber.trim()
      )
    ) {
      return "Enter a valid GST number.";
    }

    if (
      panNumber.trim() &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(
        panNumber.trim()
      )
    ) {
      return "Enter a valid PAN number.";
    }

    if (
      bankAccountNumber.trim() &&
      bankAccountNumber.trim()
        .length < 6
    ) {
      return "Enter a valid bank account number.";
    }

    if (
      ifscCode.trim() &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(
        ifscCode.trim()
      )
    ) {
      return "Enter a valid IFSC code.";
    }

    return "";
  }

  /* =========================================================
     SAVE PROFILE
  ========================================================= */

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError =
      validate();

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    if (!sellerId) {
      setError(
        "Seller authentication is missing."
      );
      return;
    }

    try {
      setSaving(true);

      const userRef = doc(
        db,
        "users",
        sellerId
      );

      const sellerRef = doc(
        db,
        "sellers",
        sellerId
      );

      /* =====================================================
         USER PROFILE UPDATE
      ===================================================== */

      await updateDoc(
        userRef,
        {
          name: name.trim(),
          phone: phone
            .replace(/\D/g, "")
            .slice(0, 10),
          updatedAt:
            serverTimestamp(),
        }
      );

      /* =====================================================
         SELLER PROFILE UPDATE
      ===================================================== */

      await updateDoc(
        sellerRef,
        {
          businessName:
            businessName.trim(),

          ownerName:
            ownerName.trim(),

          businessType,

          category:
            category.trim(),

          address:
            address.trim(),

          city:
            city.trim(),

          state:
            state.trim(),

          pincode:
            pincode.trim(),

          gstNumber:
            gstNumber
              .trim()
              .toUpperCase(),

          panNumber:
            panNumber
              .trim()
              .toUpperCase(),

          bankAccountName:
            bankAccountName.trim(),

          bankAccountNumber:
            bankAccountNumber.trim(),

          ifscCode:
            ifscCode
              .trim()
              .toUpperCase(),

          updatedAt:
            serverTimestamp(),
        }
      );

      setSuccess(
        "Seller profile updated successfully."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(
        "Seller profile update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update seller profile."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">

            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-500">
              Loading seller profile...
            </p>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     ACCESS ERROR
  ========================================================= */

  if (error && !sellerId) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">

            <div className="text-4xl">
              🔒
            </div>

            <h1 className="mt-4 text-xl font-black text-red-800">
              Seller Access Required
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

            <Link
              href="/seller"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              Seller Dashboard
            </Link>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     STATUS
  ========================================================= */

  const normalizedStatus =
    sellerStatus.toLowerCase();

  const statusClass =
    normalizedStatus ===
    "approved"
      ? "bg-green-100 text-green-700"
      : normalizedStatus ===
          "rejected"
      ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <Link
              href="/seller"
              className="text-xs font-bold text-gray-400 hover:text-black"
            >
              ← Seller Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Business Profile
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your ANJIVO seller and business information.
            </p>

          </div>

          <div
            className={`w-fit rounded-full px-4 py-2 text-xs font-bold uppercase ${statusClass}`}
          >
            {sellerVerified
              ? "✓ Verified Seller"
              : sellerStatus}
          </div>

        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">

            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>

          </div>
        )}

        {/* ===================================================
            SUCCESS
        =================================================== */}

        {success && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4">

            <p className="text-sm font-semibold text-green-700">
              ✓ {success}
            </p>

          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Section 1
            </p>

            <h2 className="mt-1 text-xl font-black">
              Personal Information
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* NAME */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Name *
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Your name"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* EMAIL */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Email *
                </label>

                <input
                  type="email"
                  value={email}
                  disabled
                  className="mt-2 w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none"
                />

                <p className="mt-1 text-[10px] text-gray-400">
                  Login email cannot be changed here.
                </p>

              </div>

              {/* PHONE */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Phone *
                </label>

                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(
                          0,
                          10
                        )
                    )
                  }
                  placeholder="10 digit mobile number"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* OWNER */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Owner Name *
                </label>

                <input
                  value={ownerName}
                  onChange={(event) =>
                    setOwnerName(
                      event.target.value
                    )
                  }
                  placeholder="Business owner name"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

            </div>
          </section>

          {/* =================================================
              BUSINESS INFORMATION
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Section 2
            </p>

            <h2 className="mt-1 text-xl font-black">
              Business Information
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* BUSINESS NAME */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Business Name *
                </label>

                <input
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(
                      event.target.value
                    )
                  }
                  placeholder="Your business name"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* BUSINESS TYPE */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Business Type *
                </label>

                <select
                  value={businessType}
                  onChange={(event) =>
                    setBusinessType(
                      event.target
                        .value as BusinessType
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >

                  <option value="INDIVIDUAL">
                    Individual
                  </option>

                  <option value="PROPRIETORSHIP">
                    Proprietorship
                  </option>

                  <option value="PARTNERSHIP">
                    Partnership
                  </option>

                  <option value="LLP">
                    LLP
                  </option>

                  <option value="PRIVATE_LIMITED">
                    Private Limited
                  </option>

                </select>

              </div>

              {/* CATEGORY */}

              <div className="sm:col-span-2">

                <label className="text-xs font-bold text-gray-700">
                  Business Category *
                </label>

                <input
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  placeholder="Example: Cosmetics, Garments, Electronics"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

            </div>
          </section>

          {/* =================================================
              ADDRESS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Section 3
            </p>

            <h2 className="mt-1 text-xl font-black">
              Business Address
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* ADDRESS */}

              <div className="sm:col-span-2">

                <label className="text-xs font-bold text-gray-700">
                  Full Address *
                </label>

                <textarea
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Shop / office / warehouse address"
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* CITY */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  City *
                </label>

                <input
                  value={city}
                  onChange={(event) =>
                    setCity(
                      event.target.value
                    )
                  }
                  placeholder="City"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* STATE */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  State *
                </label>

                <input
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target.value
                    )
                  }
                  placeholder="State"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* PINCODE */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Pincode *
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(event) =>
                    setPincode(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(
                          0,
                          6
                        )
                    )
                  }
                  placeholder="6 digit pincode"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

            </div>
          </section>

          {/* =================================================
              TAX INFORMATION
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Section 4
            </p>

            <h2 className="mt-1 text-xl font-black">
              Tax & KYC Information
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              These details may be used for seller verification and marketplace compliance.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* GST */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  GST Number
                </label>

                <input
                  value={gstNumber}
                  onChange={(event) =>
                    setGstNumber(
                      event.target.value
                        .toUpperCase()
                        .slice(
                          0,
                          15
                        )
                    )
                  }
                  placeholder="15 digit GST number"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-black"
                />

              </div>

              {/* PAN */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  PAN Number
                </label>

                <input
                  value={panNumber}
                  onChange={(event) =>
                    setPanNumber(
                      event.target.value
                        .toUpperCase()
                        .slice(
                          0,
                          10
                        )
                    )
                  }
                  placeholder="ABCDE1234F"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-black"
                />

              </div>

            </div>
          </section>

          {/* =================================================
              BANK DETAILS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Section 5
            </p>

            <h2 className="mt-1 text-xl font-black">
              Bank Details
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Bank information is required for seller payouts.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* ACCOUNT NAME */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Account Holder Name
                </label>

                <input
                  value={bankAccountName}
                  onChange={(event) =>
                    setBankAccountName(
                      event.target.value
                    )
                  }
                  placeholder="As per bank account"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* ACCOUNT NUMBER */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Bank Account Number
                </label>

                <input
                  type="password"
                  inputMode="numeric"
                  value={bankAccountNumber}
                  onChange={(event) =>
                    setBankAccountNumber(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                    )
                  }
                  placeholder="Bank account number"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-1 text-[10px] text-gray-400">
                  Hidden while typing for privacy.
                </p>

              </div>

              {/* IFSC */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  IFSC Code
                </label>

                <input
                  value={ifscCode}
                  onChange={(event) =>
                    setIfscCode(
                      event.target.value
                        .toUpperCase()
                        .slice(
                          0,
                          11
                        )
                    )
                  }
                  placeholder="SBIN0001234"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-black"
                />

              </div>

            </div>
          </section>

          {/* =================================================
              VERIFICATION
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Verification
            </p>

            <h2 className="mt-1 text-xl font-black">
              Seller Verification
            </h2>

            <div className="mt-5 rounded-2xl bg-gray-50 p-5">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-xs font-bold text-gray-400">
                    Account Status
                  </p>

                  <p className="mt-1 text-sm font-black uppercase">
                    {sellerStatus}
                  </p>

                </div>

                <span
                  className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${
                    sellerVerified
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {sellerVerified
                    ? "✓ Verified"
                    : "Verification Pending"}
                </span>

              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Seller verification status is controlled by
                ANJIVO administration. Updating your business
                details does not automatically approve your account.
              </p>

            </div>
          </section>

          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">

            <Link
              href="/seller"
              className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold text-gray-700 hover:border-black"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Business Profile"}
            </button>

          </div>

        </form>
      </main>

      <Footer />

    </div>
  );
}
