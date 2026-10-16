"use client";

import { useState } from "react";
import Link from "next/link";

export default function FloatingHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      {open && (
        <section
          aria-label="ANJIVO help"
          className="mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">ANJIVO Help</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Need help with registration or verification?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs leading-5 text-gray-600">
            <p>
              <strong className="text-gray-900">Email OTP:</strong> Check your
              spam or junk folder before requesting another code.
            </p>
            <p>
              <strong className="text-gray-900">SMS OTP:</strong> Confirm your
              mobile number and try again after a short wait if SMS delivery is
              delayed.
            </p>
            <p>
              <strong className="text-gray-900">Security:</strong> Never share
              your OTP or password with anyone.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
            >
              ANJIVO home
            </Link>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close ANJIVO help" : "Open ANJIVO help"}
        className="flex min-h-12 items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300"
      >
        <span aria-hidden="true">?</span>
        Help
      </button>
    </div>
  );
}
