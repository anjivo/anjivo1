"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";

type BusinessType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "LLP"
  | "PRIVATE_LIMITED";

const categories = [
  "Fashion & Clothing",
  "Beauty & Cosmetics",
  "Jewellery & Accessories",
  "Home & Kitchen",
  "Electronics",
  "Mobile & Accessories",
  "Toys & Games",
  "Grocery & Food",
  "Footwear",
  "Health & Personal Care",
  "Stationery & Office",
  "Automobile Accessories",
  "Furniture",
  "Sports & Fitness",
  "Other",
];

export default function SellerRegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [businessType, setBusinessType] =
    useState<BusinessType>("PROPRIETORSHIP");

  const [category, setCategory] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");

  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function cleanPhone(value: string) {
    return value.replace(/\D/g, "").slice(0, 10);
  }

  function cleanPincode(value: string) {
    return value.replace(/\D/g, "").slice(0, 6);
  }

  function cleanPAN(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  }

  function cleanGST(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
  }

  function validateStep(currentStep: number): boolean {
    setError("");

    if (currentStep === 1) {
      if (!businessName.trim()) {
        setError("Business name is required.");
        return false;
      }

      if (!ownerName.trim()) {
        setError("Owner name is required.");
        return false;
      }

      if (!/^[6-9]\d{9}$/.test(phone)) {
        setError("Please enter a valid 10-digit Indian mobile number.");
        return false;
      }

      if (!email.trim()) {
        setError("Email address is required.");
        return false;
      }

      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError("Please enter a valid email address.");
        return false;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return false;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return false;
      }

      if (!category) {
        setError("Please select your main business category.");
        return false;
      }

      return true;
    }

    if (currentStep === 2) {
      if (!address.trim()) {
        setError("Business address is required.");
        return false;
      }

      if (!city.trim()) {
        setError("City is required.");
        return false;
      }

      if (!state.trim()) {
        setError("State is required.");
        return false;
      }

      if (!/^\d{6}$/.test(pincode)) {
        setError("Please enter a valid 6-digit pincode.");
        return false;
      }

      return true;
    }

    if (currentStep === 3) {
      if (gstNumber && !/^[0-9A-Z]{15}$/.test(gstNumber)) {
        setError("Please enter a valid 15-character GSTIN.");
        return false;
      }

      if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
        setError("Please enter a valid PAN number.");
        return false;
      }

      return true;
    }

    if (currentStep === 4) {
      if (bankAccountName && bankAccountName.trim().length < 2) {
        setError("Please enter a valid account holder name.");
        return false;
      }

      if (
        bankAccountNumber &&
        bankAccountNumber.trim().length < 6
      ) {
        setError("Please enter a valid bank account number.");
        return false;
      }

      if (
        ifscCode &&
        !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)
      ) {
        setError("Please enter a valid IFSC code.");
        return false;
      }

      if (!agreeTerms) {
        setError(
          "Please accept the Seller Terms & Conditions."
        );
        return false;
      }

      return true;
    }

    return true;
  }

  function nextStep() {
    if (!validateStep(step)) return;

    setStep((current) => Math.min(current + 1, 4));
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 1));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateStep(4)) return;

    setLoading(true);
    setError("");
    setSuccess("");

    let createdUserId = "";

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanOwnerName = ownerName.trim();
      const cleanBusinessName = businessName.trim();
      const cleanPhone = `+91${phone}`;

      /*
       * STEP 1
       * Create Firebase Authentication account.
       */
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      const user = credential.user;
      createdUserId = user.uid;

      /*
       * Display name in Firebase Authentication.
       */
      await updateProfile(user, {
        displayName: cleanOwnerName,
      });

      /*
       * STEP 2
       * Create user profile.
       *
       * IMPORTANT:
       * We DO NOT give SELLER role here.
       * Admin approval will be required later.
       */
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,

        role: "RETAIL_CUSTOMER",

        customerType: "RETAIL_CUSTOMER",

        sellerApplicationStatus: "PENDING",
        sellerApplicationId: user.uid,

        emailVerified: false,
        phoneVerified: false,

        accountStatus: "PENDING_VERIFICATION",

        photoURL: "",

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      /*
       * STEP 3
       * Create seller application.
       */
      await setDoc(doc(db, "sellers", user.uid), {
        userId: user.uid,

        businessName: cleanBusinessName,
        ownerName: cleanOwnerName,

        phone: cleanPhone,
        email: cleanEmail,

        businessType,
        category,

        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode,

        gstNumber: gstNumber.trim(),
        panNumber: panNumber.trim(),

        bankAccountName: bankAccountName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),

        status: "pending",

        sellerVerified: false,
        emailVerified: false,
        phoneVerified: false,

        gstVerified: false,
        bankVerified: false,
        panVerified: false,

        adminApproved: false,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(
        "Seller application successfully submitted."
      );

      /*
       * Give Firebase a moment to finish writing,
       * then move to seller application status.
       */
      setTimeout(() => {
        router.replace("/seller/application");
      }, 1500);
    } catch (err: unknown) {
      console.error("Seller registration error:", err);

      /*
       * If account was created but Firestore application
       * failed, try to remove the newly created account.
       *
       * This is only a best-effort rollback.
       */
      if (createdUserId && auth.currentUser?.uid === createdUserId) {
        try {
          await deleteUser(auth.currentUser);
        } catch (deleteError) {
          console.error(
            "Rollback user deletion failed:",
            deleteError
          );
        }
      }

      const firebaseError = err as {
        code?: string;
        message?: string;
      };

      if (
        firebaseError.code ===
        "auth/email-already-in-use"
      ) {
        setError(
          "This email is already registered. Please login and continue your seller application."
        );
      } else if (
        firebaseError.code === "auth/weak-password"
      ) {
        setError(
          "Password is too weak. Please use at least 6 characters."
        );
      } else if (
        firebaseError.code === "auth/invalid-email"
      ) {
        setError(
          "Please enter a valid email address."
        );
      } else if (
        firebaseError.code ===
        "auth/operation-not-allowed"
      ) {
        setError(
          "Email/Password registration is not enabled in Firebase Authentication."
        );
      } else if (
        firebaseError.code ===
        "permission-denied"
      ) {
        setError(
          "Permission denied by Firebase. Please check Firestore rules."
        );
      } else {
        setError(
          firebaseError.message ||
            "Seller registration failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const stepTitles = [
    "Account & Business",
    "Business Address",
    "KYC Details",
    "Bank & Submit",
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />

      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-center gap-3">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Become an ANJIVO Seller
              </h1>

              <p className="text-sm text-slate-500">
                Register your business and start selling
                on ANJIVO.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-8">
        {/* Progress */}
        <div className="mb-8 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-4 gap-2">
            {stepTitles.map((title, index) => {
              const number = index + 1;
              const active = number === step;
              const completed = number < step;

              return (
                <div
                  key={title}
                  className="relative"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        completed
                          ? "bg-green-600 text-white"
                          : active
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      {completed ? "✓" : number}
                    </div>

                    <div className="hidden sm:block">
                      <p
                        className={[
                          "text-xs font-semibold",
                          active
                            ? "text-slate-900"
                            : "text-slate-500",
                        ].join(" ")}
                      >
                        STEP {number}
                      </p>

                      <p
                        className={[
                          "text-sm",
                          active
                            ? "font-semibold text-slate-900"
                            : "text-slate-500",
                        ].join(" ")}
                      >
                        {title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-300"
              style={{
                width: `${step * 25}%`,
              }}
            />
          </div>
        </div>

        {/* Main Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* STEP 1 */}
          {step === 1 && (
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500">
                  STEP 1
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Account & Business Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create your seller account and tell us
                  about your business.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Business Name"
                  required
                  value={businessName}
                  onChange={setBusinessName}
                  placeholder="Enter your business name"
                />

                <Field
                  label="Owner / Contact Person Name"
                  required
                  value={ownerName}
                  onChange={setOwnerName}
                  placeholder="Enter owner name"
                />

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Mobile Number
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <div className="flex overflow-hidden rounded-xl border bg-white">
                    <span className="flex items-center border-r bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                      +91
                    </span>

                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          cleanPhone(e.target.value)
                        )
                      }
                      placeholder="10 digit mobile number"
                      className="w-full px-4 py-3 text-sm outline-none"
                      maxLength={10}
                    />
                  </div>
                </div>

                <Field
                  label="Email Address"
                  required
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="business@example.com"
                />

                <Field
                  label="Create Password"
                  required
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Minimum 6 characters"
                />

                <Field
                  label="Confirm Password"
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter password"
                />

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Business Type
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    value={businessType}
                    onChange={(e) =>
                      setBusinessType(
                        e.target.value as BusinessType
                      )
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none"
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Main Product Category
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value)
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="">
                      Select category
                    </option>

                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <InfoBox>
                Your seller account will remain under
                verification until ANJIVO completes the
                required checks.
              </InfoBox>
            </section>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500">
                  STEP 2
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Business Address
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the address associated with your
                  business.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Business Address
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <textarea
                    value={address}
                    onChange={(e) =>
                      setAddress(e.target.value)
                    }
                    rows={4}
                    placeholder="Shop / office / warehouse address"
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                  />
                </div>

                <Field
                  label="City"
                  required
                  value={city}
                  onChange={setCity}
                  placeholder="Enter city"
                />

                <Field
                  label="State"
                  required
                  value={state}
                  onChange={setState}
                  placeholder="Enter state"
                />

                <Field
                  label="Pincode"
                  required
                  value={pincode}
                  onChange={(value) =>
                    setPincode(
                      cleanPincode(value)
                    )
                  }
                  placeholder="6 digit pincode"
                  maxLength={6}
                />
              </div>

              <InfoBox>
                This address may be used for seller
                verification, pickup and business records.
              </InfoBox>
            </section>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500">
                  STEP 3
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  KYC & Tax Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Provide your PAN and GST information
                  where applicable.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="PAN Number"
                  value={panNumber}
                  onChange={(value) =>
                    setPanNumber(cleanPAN(value))
                  }
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />

                <Field
                  label="GSTIN"
                  value={gstNumber}
                  onChange={(value) =>
                    setGstNumber(cleanGST(value))
                  }
                  placeholder="15 character GSTIN"
                  maxLength={15}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <VerificationCard
                  title="PAN Verification"
                  text="Verification will be completed by ANJIVO."
                />

                <VerificationCard
                  title="GST Verification"
                  text="GST details will be checked where applicable."
                />

                <VerificationCard
                  title="Business Review"
                  text="Final seller approval is done by ANJIVO."
                />
              </div>

              <InfoBox>
                Do not enter incorrect or someone else&apos;s
                KYC details. Verification will be required
                before seller approval.
              </InfoBox>
            </section>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500">
                  STEP 4
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Bank Details & Submit
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add your bank account for future
                  marketplace settlements.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Account Holder Name"
                  value={bankAccountName}
                  onChange={setBankAccountName}
                  placeholder="Name as per bank account"
                />

                <Field
                  label="Bank Account Number"
                  value={bankAccountNumber}
                  onChange={(value) =>
                    setBankAccountNumber(
                      value.replace(/\D/g, "")
                    )
                  }
                  placeholder="Enter account number"
                />

                <Field
                  label="IFSC Code"
                  value={ifscCode}
                  onChange={(value) =>
                    setIfscCode(
                      value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ""
                        )
                        .slice(0, 11)
                    )
                  }
                  placeholder="SBIN0000000"
                  maxLength={11}
                />
              </div>

              <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-bold text-amber-900">
                  Seller verification
                </h3>

                <ul className="mt-3 space-y-2 text-sm text-amber-800">
                  <li>✓ Email verification required</li>
                  <li>✓ Mobile OTP verification required</li>
                  <li>✓ KYC verification</li>
                  <li>✓ Bank verification</li>
                  <li>✓ ANJIVO admin approval</li>
                </ul>
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) =>
                    setAgreeTerms(e.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />

                <span className="text-sm text-slate-600">
                  I confirm that the information provided
                  by me is accurate and I agree to ANJIVO
                  Seller Terms & Conditions and marketplace
                  policies.
                </span>
              </label>
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {success}
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={previousStep}
                  disabled={loading}
                  className="w-full rounded-xl border bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                >
                  ← Previous
                </button>
              )}
            </div>

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-7 py-3 text-sm font-bold text-white hover:bg-slate-800 sm:w-auto"
              >
                Continue →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-7 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading
                  ? "Creating Seller Account..."
                  : "Submit Seller Application"}
              </button>
            )}
          </div>
        </form>

        {/* Trust section */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <TrustCard
            icon="🔐"
            title="Secure Account"
            text="Your account information is securely stored."
          />

          <TrustCard
            icon="✓"
            title="Verification"
            text="Seller applications are reviewed before approval."
          />

          <TrustCard
            icon="💳"
            title="Marketplace Payments"
            text="Approved sellers can receive marketplace settlements."
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}

/* ---------------------------------------------
   Reusable Field
--------------------------------------------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

/* ---------------------------------------------
   Info Box
--------------------------------------------- */

function InfoBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
      <div className="flex gap-3">
        <span className="text-lg">ℹ️</span>
        <p>{children}</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------
   Verification Card
--------------------------------------------- */

function VerificationCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow-sm">
          ✓
        </span>

        <h3 className="text-sm font-bold text-slate-900">
          {title}
        </h3>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}

/* ---------------------------------------------
   Trust Card
--------------------------------------------- */

function TrustCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
          {icon}
        </div>

        <div>
          <h3 className="font-bold text-slate-900">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
