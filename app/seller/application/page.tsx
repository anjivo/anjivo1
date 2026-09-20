"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type SellerApplication = {
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  status?: string;

  sellerVerified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  gstVerified?: boolean;
  panVerified?: boolean;
  bankVerified?: boolean;
  adminApproved?: boolean;
  accountStatus?: string;
};

export default function SellerApplicationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] =
    useState<SellerApplication | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace(
            "/login?redirect=/seller/application"
          );
          return;
        }

        try {
          setLoading(true);
          setError("");

          const sellerRef = doc(
            db,
            "sellers",
            user.uid
          );

          const sellerSnap =
            await getDoc(sellerRef);

          if (!sellerSnap.exists()) {
            setError(
              "Seller application nahi mili."
            );
            setLoading(false);
            return;
          }

          setApplication(
            sellerSnap.data() as SellerApplication
          );
        } catch (err) {
          console.error(
            "Seller application error:",
            err
          );

          setError(
            "Application status load nahi ho saka."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  const getStatusLabel = () => {
    if (
      application?.status === "approved" &&
      application?.adminApproved === true
    ) {
      return "Approved";
    }

    if (
      application?.status === "rejected"
    ) {
      return "Rejected";
    }

    return "Under Review";
  };

  const getStatusMessage = () => {
    if (
      application?.status === "approved" &&
      application?.adminApproved === true
    ) {
      return "Congratulations! Aapka seller account approve ho gaya hai.";
    }

    if (
      application?.status === "rejected"
    ) {
      return "Aapki seller application reject hui hai. Admin se correction details check karein.";
    }

    return "Aapki application successfully submit ho chuki hai aur admin verification ke under hai.";
  };

  const verificationItems = [
    {
      title: "Email Verification",
      verified:
        application?.emailVerified === true,
    },
    {
      title: "Mobile Verification",
      verified:
        application?.phoneVerified === true,
    },
    {
      title: "PAN Verification",
      verified:
        application?.panVerified === true,
    },
    {
      title: "GST Verification",
      verified:
        application?.gstVerified === true,
    },
    {
      title: "Bank Verification",
      verified:
        application?.bankVerified === true,
    },
    {
      title: "Admin Approval",
      verified:
        application?.adminApproved === true,
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="text-gray-600">
            Application status load ho raha hai...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl">
            !
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Application Not Found
          </h1>

          <p className="mt-3 text-gray-600">
            {error}
          </p>

          <button
            onClick={() =>
              router.push("/seller/register")
            }
            className="mt-6 rounded-xl bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800"
          >
            Seller Registration
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center"
          >
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </button>

          <div className="text-right">
            <p className="text-xs text-gray-500">
              Seller Application
            </p>

            <p className="text-sm font-semibold text-gray-900">
              {application?.businessName ||
                "Business"}
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">

        {/* Status Card */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">

          <div className="bg-black px-6 py-8 text-white sm:px-10">
            <p className="text-sm text-gray-300">
              ANJIVO Seller Program
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Seller Application Status
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              {getStatusMessage()}
            </p>
          </div>

          <div className="p-6 sm:p-10">

            {/* Application Status */}
            <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Current Status
                </p>

                <h2 className="mt-1 text-2xl font-bold text-gray-900">
                  {getStatusLabel()}
                </h2>
              </div>

              <div
                className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                  application?.status ===
                    "approved" &&
                  application?.adminApproved ===
                    true
                    ? "bg-green-100 text-green-700"
                    : application?.status ===
                        "rejected"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {application?.status ===
                  "approved" &&
                application?.adminApproved ===
                  true
                  ? "APPROVED"
                  : application?.status ===
                    "rejected"
                  ? "REJECTED"
                  : "PENDING REVIEW"}
              </div>
            </div>

            {/* Business Information */}
            <div className="mt-8">
              <h2 className="text-lg font-bold text-gray-900">
                Business Information
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">

                <InfoBox
                  label="Business Name"
                  value={
                    application?.businessName ||
                    "-"
                  }
                />

                <InfoBox
                  label="Owner Name"
                  value={
                    application?.ownerName ||
                    "-"
                  }
                />

                <InfoBox
                  label="Email"
                  value={
                    application?.email || "-"
                  }
                />

                <InfoBox
                  label="Mobile"
                  value={
                    application?.phone || "-"
                  }
                />

              </div>
            </div>

            {/* Verification */}
            <div className="mt-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Verification Status
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Aapke seller account ki verification progress.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">

                {verificationItems.map(
                  (item) => (
                    <VerificationRow
                      key={item.title}
                      title={item.title}
                      verified={
                        item.verified
                      }
                    />
                  )
                )}

              </div>
            </div>

            {/* Progress */}
            <div className="mt-10">
              <h2 className="text-lg font-bold text-gray-900">
                Application Progress
              </h2>

              <div className="mt-5 space-y-5">

                <ProgressStep
                  number="1"
                  title="Application Submitted"
                  completed
                />

                <ProgressStep
                  number="2"
                  title="Document & Verification"
                  completed={
                    verificationItems
                      .filter(
                        (item) =>
                          item.title !==
                          "Admin Approval"
                      )
                      .every(
                        (item) =>
                          item.verified
                      )
                  }
                />

                <ProgressStep
                  number="3"
                  title="Admin Review"
                  completed={
                    application?.adminApproved ===
                    true
                  }
                />

                <ProgressStep
                  number="4"
                  title="Seller Account Activation"
                  completed={
                    application?.status ===
                      "approved" &&
                    application?.adminApproved ===
                      true
                  }
                />

              </div>
            </div>

            {/* Action */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">

              {application?.status ===
                "approved" &&
              application?.adminApproved ===
                true ? (
                <button
                  onClick={() =>
                    router.push(
                      "/seller/dashboard"
                    )
                  }
                  className="rounded-xl bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
                >
                  Go to Seller Dashboard
                </button>
              ) : (
                <button
                  onClick={() =>
                    window.location.reload()
                  }
                  className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  Refresh Status
                </button>
              )}

              <button
                onClick={() => router.push("/")}
                className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to ANJIVO
              </button>

            </div>

          </div>
        </div>
      </section>
    </main>
  );
}


// =========================================================
// INFO BOX
// =========================================================

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}


// =========================================================
// VERIFICATION ROW
// =========================================================

function VerificationRow({
  title,
  verified,
}: {
  title: string;
  verified: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">

      <div className="flex items-center gap-3">

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            verified
              ? "bg-green-100"
              : "bg-yellow-100"
          }`}
        >
          <span
            className={
              verified
                ? "text-green-700"
                : "text-yellow-700"
            }
          >
            {verified ? "✓" : "!"}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">
            {title}
          </p>

          <p className="text-xs text-gray-500">
            {verified
              ? "Verified"
              : "Pending"}
          </p>
        </div>

      </div>

      <span
        className={`text-xs font-bold ${
          verified
            ? "text-green-600"
            : "text-yellow-600"
        }`}
      >
        {verified
          ? "VERIFIED"
          : "PENDING"}
      </span>

    </div>
  );
}


// =========================================================
// PROGRESS STEP
// =========================================================

function ProgressStep({
  number,
  title,
  completed,
}: {
  number: string;
  title: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-4">

      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          completed
            ? "bg-green-600 text-white"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {completed ? "✓" : number}
      </div>

      <div className="flex-1">
        <p
          className={`text-sm font-semibold ${
            completed
              ? "text-gray-900"
              : "text-gray-500"
          }`}
        >
          {title}
        </p>
      </div>

      <span
        className={`text-xs font-semibold ${
          completed
            ? "text-green-600"
            : "text-gray-400"
        }`}
      >
        {completed
          ? "Complete"
          : "Pending"}
      </span>

    </div>
  );
}
