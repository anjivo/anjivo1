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
import { auth, db } from "@/lib/firebase";
import {
  createSellerApplication,
} from "@/lib/sellers";

export default function SellerRegisterPage() {
  const router = useRouter();

  const [userId, setUserId] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [businessName, setBusinessName] =
    useState("");

  const [ownerName, setOwnerName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [businessType, setBusinessType] =
    useState<
      | "INDIVIDUAL"
      | "PROPRIETORSHIP"
      | "PARTNERSHIP"
      | "LLP"
      | "PRIVATE_LIMITED"
    >("INDIVIDUAL");

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

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/seller/register"
            );
            return;
          }

          try {
            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const snapshot =
              await getDoc(userRef);

            if (snapshot.exists()) {
              const data =
                snapshot.data();

              if (
                data.role === "SELLER"
              ) {
                setError(
                  "You already have a seller account."
                );
              }
            }

            setUserId(user.uid);
            setEmail(
              user.email || ""
            );
          } catch (err) {
            console.error(err);

            setError(
              "Unable to load account."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  function validate() {
    if (!businessName.trim()) {
      return "Business name is required.";
    }

    if (!ownerName.trim()) {
      return "Owner name is required.";
    }

    if (
      !/^[6-9]\d{9}$/.test(
        phone
      )
    ) {
      return "Enter a valid 10-digit mobile number.";
    }

    if (!category.trim()) {
      return "Please select your business category.";
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
        pincode
      )
    ) {
      return "Enter a valid 6-digit pincode.";
    }

    if (
      gstNumber.trim() &&
      !/^[0-9A-Z]{15}$/.test(
        gstNumber
          .trim()
          .toUpperCase()
      )
    ) {
      return "Enter a valid GSTIN.";
    }

    if (
      panNumber.trim() &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(
        panNumber
          .trim()
          .toUpperCase()
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
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
        ifscCode
          .trim()
          .toUpperCase()
      )
    ) {
      return "Enter a valid IFSC code.";
    }

    return "";
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!userId) {
      setError(
        "Please login first."
      );
      return;
    }

    try {
      setSaving(true);

      const sellerId =
        await createSellerApplication({
          userId,

          businessName:
            businessName.trim(),

          ownerName:
            ownerName.trim(),

          phone: phone.trim(),

          email: email
            .trim()
            .toLowerCase(),

          businessType,

          category:
            category.trim(),

          address:
            address.trim(),

          city: city.trim(),

          state: state.trim(),

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

          status: "pending",
        });

      console.log(
        "Seller application:",
        sellerId
      );

      setSuccess(
        "Seller application submitted successfully."
      );

      setTimeout(() => {
        router.push(
          "/seller/application"
        );
      }, 800);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to submit application. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-4xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            ⏳ Loading...
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">

        <div className="mb-6">

          <Link
            href="/"
            className="text-xs font-bold text-gray-400 hover:text-black"
          >
            ← Home
          </Link>

          <h1 className="mt-3 text-3xl font-black">
            Become an ANJIVO Seller
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Register your business and start selling on ANJIVO.
          </p>

        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {success}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          {/* BUSINESS */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 1
            </p>

            <h2 className="mt-1 text-xl font-black">
              Business Information
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold">
                  Business Name *
                </label>

                <input
                  value={businessName}
                  onChange={(e) =>
                    setBusinessName(
                      e.target.value
                    )
                  }
                  placeholder="Your business / shop name"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Owner Name *
                </label>

                <input
                  value={ownerName}
                  onChange={(e) =>
                    setOwnerName(
                      e.target.value
                    )
                  }
                  placeholder="Owner / authorized person"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Mobile Number *
                </label>

                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) =>
                    setPhone(
                      e.target.value.replace(
                        /\D/g,
                        ""
                      )
                    )
                  }
                  placeholder="10-digit mobile"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Business Type *
                </label>

                <select
                  value={businessType}
                  onChange={(e) =>
                    setBusinessType(
                      e.target.value as
                        | "INDIVIDUAL"
                        | "PROPRIETORSHIP"
                        | "PARTNERSHIP"
                        | "LLP"
                        | "PRIVATE_LIMITED"
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
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

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Main Product Category *
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">
                    Select Category
                  </option>

                  <option value="Fashion">
                    Fashion
                  </option>

                  <option value="Beauty">
                    Beauty & Cosmetics
                  </option>

                  <option value="Electronics">
                    Electronics
                  </option>

                  <option value="Toys">
                    Toys
                  </option>

                  <option value="Home">
                    Home & Kitchen
                  </option>

                  <option value="Grocery">
                    Grocery
                  </option>

                  <option value="Jewellery">
                    Jewellery
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

            </div>

          </section>

          {/* ADDRESS */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 2
            </p>

            <h2 className="mt-1 text-xl font-black">
              Business Address
            </h2>

            <div className="mt-6 space-y-4">

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Full Address *
                </label>

                <textarea
                  value={address}
                  onChange={(e) =>
                    setAddress(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Shop / office / warehouse address"
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">

                <div>
                  <label className="mb-2 block text-xs font-bold">
                    City *
                  </label>

                  <input
                    value={city}
                    onChange={(e) =>
                      setCity(
                        e.target.value
                      )
                    }
                    placeholder="City"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold">
                    State *
                  </label>

                  <input
                    value={state}
                    onChange={(e) =>
                      setState(
                        e.target.value
                      )
                    }
                    placeholder="State"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold">
                    Pincode *
                  </label>

                  <input
                    value={pincode}
                    maxLength={6}
                    onChange={(e) =>
                      setPincode(
                        e.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    placeholder="6-digit pincode"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

              </div>

            </div>

          </section>

          {/* KYC */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 3
            </p>

            <h2 className="mt-1 text-xl font-black">
              Business KYC
            </h2>

            <p className="mt-1 text-xs text-gray-400">
              These details will be used for seller verification.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <div>
                <label className="mb-2 block text-xs font-bold">
                  GSTIN
                  <span className="ml-1 font-normal text-gray-400">
                    (Optional)
                  </span>
                </label>

                <input
                  value={gstNumber}
                  maxLength={15}
                  onChange={(e) =>
                    setGstNumber(
                      e.target.value
                        .toUpperCase()
                    )
                  }
                  placeholder="15-character GSTIN"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  PAN Number
                  <span className="ml-1 font-normal text-gray-400">
                    (Optional)
                  </span>
                </label>

                <input
                  value={panNumber}
                  maxLength={10}
                  onChange={(e) =>
                    setPanNumber(
                      e.target.value
                        .toUpperCase()
                    )
                  }
                  placeholder="ABCDE1234F"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-black"
                />
              </div>

            </div>

          </section>

          {/* BANK */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 4
            </p>

            <h2 className="mt-1 text-xl font-black">
              Bank Details
            </h2>

            <p className="mt-1 text-xs text-gray-400">
              Used later for seller payouts.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Account Holder Name
                </label>

                <input
                  value={bankAccountName}
                  onChange={(e) =>
                    setBankAccountName(
                      e.target.value
                    )
                  }
                  placeholder="As per bank account"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  Account Number
                </label>

                <input
                  type="password"
                  value={bankAccountNumber}
                  onChange={(e) =>
                    setBankAccountNumber(
                      e.target.value.replace(
                        /\D/g,
                        ""
                      )
                    )
                  }
                  placeholder="Bank account number"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold">
                  IFSC Code
                </label>

                <input
                  value={ifscCode}
                  maxLength={11}
                  onChange={(e) =>
                    setIfscCode(
                      e.target.value
                        .toUpperCase()
                    )
                  }
                  placeholder="ABCD0123456"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm uppercase outline-none focus:border-black"
                />
              </div>

            </div>

          </section>

          {/* SUBMIT */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="rounded-2xl bg-gray-50 p-4">

              <p className="text-xs font-black">
                Seller Verification
              </p>

              <p className="mt-1 text-[10px] leading-5 text-gray-500">
                After submission, your application will remain
                <strong> pending </strong>
                until an ANJIVO admin reviews and approves it.
              </p>

            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <Link
                href="/"
                className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Submitting..."
                  : "Submit Seller Application"}
              </button>

            </div>

          </section>

        </form>

      </main>

      <Footer />

    </div>
  );
}
