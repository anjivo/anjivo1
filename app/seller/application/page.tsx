"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

import {
  sendMobileOTP,
  verifyMobileOTP,
  resetPhoneRecaptcha,
} from "@/lib/phoneAuth";

import {
  sendUserEmailVerification,
  refreshEmailVerificationStatus,
} from "@/lib/auth";


/* =========================================================
   TYPES
========================================================= */

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


/* =========================================================
   PAGE
========================================================= */

export default function SellerApplicationPage() {

  const router = useRouter();


  /* =======================================================
     APPLICATION STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [application, setApplication] =
    useState<SellerApplication | null>(
      null
    );

  const [error, setError] =
    useState("");


  /* =======================================================
     EMAIL VERIFICATION STATE
  ======================================================= */

  const [
    sendingEmail,
    setSendingEmail,
  ] = useState(false);

  const [
    checkingEmail,
    setCheckingEmail,
  ] = useState(false);

  const [
    emailMessage,
    setEmailMessage,
  ] = useState("");

  const [
    emailError,
    setEmailError,
  ] = useState("");

  const [
    emailCooldown,
    setEmailCooldown,
  ] = useState(0);


  /* =======================================================
     MOBILE OTP STATE
  ======================================================= */

  const [
    otpSent,
    setOtpSent,
  ] = useState(false);

  const [
    otp,
    setOtp,
  ] = useState("");

  const [
    sendingOtp,
    setSendingOtp,
  ] = useState(false);

  const [
    verifyingOtp,
    setVerifyingOtp,
  ] = useState(false);

  const [
    phoneMessage,
    setPhoneMessage,
  ] = useState("");

  const [
    phoneError,
    setPhoneError,
  ] = useState("");

  const [
    resendSeconds,
    setResendSeconds,
  ] = useState(0);


  /* =======================================================
     LOAD APPLICATION
  ======================================================= */

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
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

            const sellerRef =
              doc(
                db,
                "sellers",
                user.uid
              );

            const sellerSnap =
              await getDoc(
                sellerRef
              );


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


    return () => {

      unsubscribe();

      resetPhoneRecaptcha();
    };

  }, [router]);


  /* =======================================================
     COOLDOWN TIMER
  ======================================================= */

  useEffect(() => {

    if (resendSeconds <= 0) {
      return;
    }


    const timer =
      window.setInterval(() => {

        setResendSeconds(
          (seconds) =>
            Math.max(
              seconds - 1,
              0
            )
        );

      }, 1000);


    return () => {
      window.clearInterval(timer);
    };

  }, [resendSeconds]);


  /* =======================================================
     REFRESH APPLICATION
  ======================================================= */

  const refreshApplication =
    async () => {

      const user =
        auth.currentUser;

      if (!user) {
        return;
      }


      try {

        const sellerRef =
          doc(
            db,
            "sellers",
            user.uid
          );

        const sellerSnap =
          await getDoc(
            sellerRef
          );


        if (sellerSnap.exists()) {

          setApplication(
            sellerSnap.data() as SellerApplication
          );
        }

      } catch (err) {

        console.error(
          "Refresh application error:",
          err
        );
      }
    };


  /* =======================================================
     EMAIL VERIFICATION
  ======================================================= */

  const handleSendEmailVerification =
    async () => {

      setEmailError("");
      setEmailMessage("");


      if (!auth.currentUser) {

        setEmailError(
          "Please login again."
        );

        return;
      }


      if (
        auth.currentUser.emailVerified
      ) {

        setEmailMessage(
          "Email already verified hai."
        );

        return;
      }


      if (emailCooldown > 0) {
        return;
      }


      try {

        setSendingEmail(true);


        await sendUserEmailVerification();


        setEmailMessage(
          "Verification email bhej diya gaya hai. Apne email inbox mein link open karein."
        );


        setEmailCooldown(60);

      } catch (err) {

        console.error(
          "Email verification error:",
          err
        );


        setEmailError(
          err instanceof Error
            ? err.message
            : "Verification email send nahi ho saka."
        );

      } finally {

        setSendingEmail(false);
      }
    };


  /* =======================================================
     CHECK EMAIL VERIFICATION
  ======================================================= */

  const handleCheckEmail =
    async () => {

      setEmailError("");
      setEmailMessage("");


      if (!auth.currentUser) {

        setEmailError(
          "Please login again."
        );

        return;
      }


      try {

        setCheckingEmail(true);


        const verified =
          await refreshEmailVerificationStatus();


        if (verified) {

          setEmailMessage(
            "✓ Email successfully verified."
          );

        } else {

          setEmailMessage(
            "Email abhi verify nahi hua hai. Pehle inbox mein verification link open karein."
          );
        }


        await refreshApplication();

      } catch (err) {

        console.error(
          "Email check error:",
          err
        );


        setEmailError(
          err instanceof Error
            ? err.message
            : "Email verification status check nahi ho saka."
        );

      } finally {

        setCheckingEmail(false);
      }
    };


  /* =======================================================
     SEND MOBILE OTP
  ======================================================= */

  const handleSendOTP =
    async () => {

      setPhoneError("");
      setPhoneMessage("");


      if (!auth.currentUser) {

        setPhoneError(
          "Please login again."
        );

        return;
      }


      if (
        auth.currentUser.phoneNumber
      ) {

        setPhoneMessage(
          "Mobile number Firebase Auth mein already verified hai."
        );

        return;
      }


      if (resendSeconds > 0) {
        return;
      }


      const phone =
        application?.phone?.trim();


      if (!phone) {

        setPhoneError(
          "Seller application mein mobile number nahi mila."
        );

        return;
      }


      try {

        setSendingOtp(true);


        await sendMobileOTP(
          phone,
          "recaptcha-container"
        );


        setOtpSent(true);

        setResendSeconds(60);


        setPhoneMessage(
          "OTP aapke mobile number par bhej diya gaya hai."
        );

      } catch (err) {

        console.error(
          "Send OTP error:",
          err
        );


        setPhoneError(
          err instanceof Error
            ? err.message
            : "OTP send nahi ho saka."
        );

      } finally {

        setSendingOtp(false);
      }
    };


  /* =======================================================
     VERIFY MOBILE OTP
  ======================================================= */

  const handleVerifyOTP =
    async () => {

      setPhoneError("");
      setPhoneMessage("");


      if (!otpSent) {

        setPhoneError(
          "Pehle OTP request karein."
        );

        return;
      }


      if (
        !/^\d{6}$/.test(
          otp.trim()
        )
      ) {

        setPhoneError(
          "Please 6-digit OTP enter karein."
        );

        return;
      }


      try {

        setVerifyingOtp(true);


        await verifyMobileOTP(
          otp.trim()
        );


        setPhoneMessage(
          "✓ Mobile number successfully verify ho gaya."
        );


        setOtp("");

        setOtpSent(false);


        /*
         * Firebase Auth user is now linked
         * with the verified phone number.
         */
        await refreshApplication();

      } catch (err) {

        console.error(
          "Verify OTP error:",
          err
        );


        setPhoneError(
          err instanceof Error
            ? err.message
            : "OTP verification failed."
        );

      } finally {

        setVerifyingOtp(false);
      }
    };


  /* =======================================================
     VERIFICATION ITEMS
  ======================================================= */

  const verificationItems = [

    {
      title:
        "Email Verification",

      verified:
        application?.emailVerified ===
        true ||
        auth.currentUser?.emailVerified ===
        true,
    },

    {
      title:
        "Mobile Verification",

      verified:
        application?.phoneVerified ===
        true ||
        Boolean(
          auth.currentUser?.phoneNumber
        ),
    },

    {
      title:
        "PAN Verification",

      verified:
        application?.panVerified ===
        true,
    },

    {
      title:
        "GST Verification",

      verified:
        application?.gstVerified ===
        true,
    },

    {
      title:
        "Bank Verification",

      verified:
        application?.bankVerified ===
        true,
    },

    {
      title:
        "Admin Approval",

      verified:
        application?.adminApproved ===
        true,
    },

  ];


  /* =======================================================
     STATUS
  ======================================================= */

  const getStatusLabel =
    () => {

      if (
        application?.status ===
          "approved" &&
        application?.adminApproved ===
          true
      ) {

        return "Approved";
      }


      if (
        application?.status ===
        "rejected"
      ) {

        return "Rejected";
      }


      return "Under Review";
    };


  const getStatusMessage =
    () => {

      if (
        application?.status ===
          "approved" &&
        application?.adminApproved ===
          true
      ) {

        return "Congratulations! Aapka seller account approve ho gaya hai.";
      }


      if (
        application?.status ===
        "rejected"
      ) {

        return "Aapki seller application reject hui hai. Admin se correction details check karein.";
      }


      return "Aapki application successfully submit ho chuki hai aur admin verification ke under hai.";
    };


  /* =======================================================
     LOADING
  ======================================================= */

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


  /* =======================================================
     ERROR
  ======================================================= */

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
              router.push(
                "/seller/register"
              )
            }
            className="mt-6 rounded-xl bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800"
          >
            Seller Registration
          </button>

        </div>

      </main>
    );
  }


  /* =======================================================
     MAIN
  ======================================================= */

  return (

    <main className="min-h-screen bg-gray-50">


      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

          <button
            onClick={() =>
              router.push("/")
            }
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


      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">


          {/* =================================================
              HERO
          ================================================= */}

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


            {/* =================================================
                APPLICATION STATUS
            ================================================= */}

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


            {/* =================================================
                BUSINESS INFORMATION
            ================================================= */}

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
                    application?.email ||
                    "-"
                  }
                />


                <InfoBox
                  label="Mobile"
                  value={
                    application?.phone ||
                    "-"
                  }
                />

              </div>

            </div>


            {/* =================================================
                VERIFICATION STATUS
            ================================================= */}

            <div className="mt-10">

              <h2 className="text-lg font-bold text-gray-900">
                Verification Status
              </h2>


              <p className="mt-1 text-sm text-gray-500">
                Aapke seller account ki verification progress.
              </p>


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


            {/* =================================================
                EMAIL VERIFICATION
            ================================================= */}

            {!auth.currentUser?.emailVerified && (

              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <h3 className="text-base font-bold text-gray-900">
                      Verify Email Address
                    </h3>


                    <p className="mt-1 text-sm text-gray-500">
                      Apne registered email par verification link bhejein.
                    </p>


                    <p className="mt-2 break-all text-sm font-semibold text-gray-900">
                      {auth.currentUser?.email ||
                        application?.email ||
                        "-"}
                    </p>

                  </div>


                  <button
                    type="button"
                    onClick={
                      handleSendEmailVerification
                    }
                    disabled={
                      sendingEmail ||
                      emailCooldown > 0
                    }
                    className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >

                    {sendingEmail
                      ? "Sending..."
                      : emailCooldown > 0
                      ? `Resend in ${emailCooldown}s`
                      : "Send Verification Email"}

                  </button>

                </div>


                <div className="mt-5">

                  <button
                    type="button"
                    onClick={
                      handleCheckEmail
                    }
                    disabled={
                      checkingEmail
                    }
                    className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >

                    {checkingEmail
                      ? "Checking..."
                      : "I Have Verified — Check Status"}

                  </button>

                </div>


                {emailMessage && (

                  <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    {emailMessage}
                  </div>

                )}


                {emailError && (

                  <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {emailError}
                  </div>

                )}

              </div>

            )}


            {/* =================================================
                EMAIL VERIFIED MESSAGE
            ================================================= */}

            {auth.currentUser?.emailVerified && (

              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                    ✓
                  </div>


                  <div>

                    <p className="font-bold text-green-800">
                      Email Verified
                    </p>

                    <p className="text-sm text-green-700">
                      Aapka email Firebase Auth mein verified hai.
                    </p>

                  </div>

                </div>

              </div>

            )}


            {/* =================================================
                MOBILE VERIFICATION
            ================================================= */}

            {!auth.currentUser?.phoneNumber && (

              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <h3 className="text-base font-bold text-gray-900">
                      Verify Mobile Number
                    </h3>


                    <p className="mt-1 text-sm text-gray-500">
                      OTP verify karke registered mobile number confirm karein.
                    </p>


                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {maskPhone(
                        application?.phone
                      )}
                    </p>

                  </div>


                  {!otpSent && (

                    <button
                      type="button"
                      onClick={
                        handleSendOTP
                      }
                      disabled={
                        sendingOtp ||
                        resendSeconds > 0
                      }
                      className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      {sendingOtp
                        ? "Sending OTP..."
                        : resendSeconds > 0
                        ? `Resend in ${resendSeconds}s`
                        : "Send OTP"}

                    </button>

                  )}

                </div>


                {/* RECAPTCHA */}

                <div
                  id="recaptcha-container"
                  className="mt-4"
                />


                {/* OTP */}

                {otpSent && (

                  <div className="mt-5">

                    <label
                      htmlFor="seller-otp"
                      className="text-sm font-semibold text-gray-900"
                    >
                      Enter 6-digit OTP
                    </label>


                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">

                      <input
                        id="seller-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(e) =>
                          setOtp(
                            e.target.value.replace(
                              /\D/g,
                              ""
                            )
                          )
                        }
                        placeholder="000000"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] outline-none focus:border-black sm:max-w-xs"
                      />


                      <button
                        type="button"
                        onClick={
                          handleVerifyOTP
                        }
                        disabled={
                          verifyingOtp ||
                          otp.length !== 6
                        }
                        className="rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >

                        {verifyingOtp
                          ? "Verifying..."
                          : "Verify OTP"}

                      </button>

                    </div>


                    <div className="mt-4 flex flex-wrap items-center gap-4">

                      <button
                        type="button"
                        onClick={
                          handleSendOTP
                        }
                        disabled={
                          sendingOtp ||
                          resendSeconds > 0
                        }
                        className="text-sm font-semibold text-gray-900 underline disabled:cursor-not-allowed disabled:opacity-40"
                      >

                        {resendSeconds > 0
                          ? `Resend in ${resendSeconds}s`
                          : "Resend OTP"}

                      </button>


                      <button
                        type="button"
                        onClick={() => {

                          setOtpSent(
                            false
                          );

                          setOtp("");

                          setPhoneError(
                            ""
                          );

                          setPhoneMessage(
                            ""
                          );

                          resetPhoneRecaptcha();

                        }}
                        className="text-sm text-gray-500 underline"
                      >
                        Cancel
                      </button>

                    </div>

                  </div>

                )}


                {phoneMessage && (

                  <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    {phoneMessage}
                  </div>

                )}


                {phoneError && (

                  <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {phoneError}
                  </div>

                )}

              </div>

            )}


            {/* =================================================
                MOBILE VERIFIED
            ================================================= */}

            {auth.currentUser?.phoneNumber && (

              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                    ✓
                  </div>


                  <div>

                    <p className="font-bold text-green-800">
                      Mobile Verified
                    </p>

                    <p className="text-sm text-green-700">
                      {maskPhone(
                        auth.currentUser.phoneNumber
                      )}
                    </p>

                  </div>

                </div>

              </div>

            )}


            {/* =================================================
                PROGRESS
            ================================================= */}

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


            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">

              {application?.status ===
                "approved" &&
              application?.adminApproved ===
                true ? (

                <button
                  type="button"
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
                  type="button"
                  onClick={
                    refreshApplication
                  }
                  className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  Refresh Status
                </button>

              )}


              <button
                type="button"
                onClick={() =>
                  router.push("/")
                }
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


/* =========================================================
   MASK PHONE
========================================================= */

function maskPhone(
  phone?: string | null
): string {

  if (!phone) {
    return "Mobile number unavailable";
  }


  const clean =
    phone.replace(
      /\s+/g,
      ""
    );


  if (clean.length >= 10) {

    return (
      clean.slice(0, 3) +
      "****" +
      clean.slice(-3)
    );
  }


  return clean;
}


/* =========================================================
   INFO BOX
========================================================= */

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


/* =========================================================
   VERIFICATION ROW
========================================================= */

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
            {verified
              ? "✓"
              : "!"}
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


/* =========================================================
   PROGRESS STEP
========================================================= */

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

        {completed
          ? "✓"
          : number}

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
