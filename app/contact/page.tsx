"use client";

import Link from "next/link";
import { useState } from "react";

const WHATSAPP_NUMBER = "919219495647";
const SUPPORT_EMAIL = "supportinfo@anjivo.online";

export default function ContactPage() {
  const [subject, setSubject] = useState("Order / Delivery");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = [
      "ANJIVO Customer Support Request",
      `Subject: ${subject}`,
      `Order ID: ${orderId.trim() || "Not provided"}`,
      "",
      "Message:",
      message.trim(),
    ].join("\n");

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      text
    )}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  function handleEmailSubmit() {
    const emailSubject = `ANJIVO Support - ${subject}`;

    const emailBody = [
      "ANJIVO Customer Support Request",
      `Subject: ${subject}`,
      `Order ID: ${orderId.trim() || "Not provided"}`,
      "",
      "Message:",
      message.trim(),
    ].join("\n");

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-2xl bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            ANJIVO Customer Care
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
            Contact Support
          </h1>

          <p className="mt-4 leading-7 text-gray-600">
            Order, payment, delivery, returns ya account se related problem
            hai? Apni query ki details bhejein. Hamari support team aapki
            help karegi.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-green-200 bg-green-50 p-4 transition hover:bg-green-100"
            >
              <p className="font-semibold text-gray-900">
                WhatsApp Support
              </p>
              <p className="mt-1 text-sm text-gray-700">
                +91 9219495647
              </p>
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="rounded-xl border border-blue-200 bg-blue-50 p-4 transition hover:bg-blue-100"
            >
              <p className="font-semibold text-gray-900">
                Email Support
              </p>
              <p className="mt-1 break-all text-sm text-gray-700">
                {SUPPORT_EMAIL}
              </p>
            </a>
          </div>
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              How Can We Help?
            </h2>

            <div className="mt-5 space-y-4">
              <Link
                href="/account/orders"
                className="block rounded-xl border p-4 hover:bg-gray-50"
              >
                <p className="font-semibold text-gray-900">My Orders</p>
                <p className="mt-1 text-sm text-gray-600">
                  Apne orders aur order status check karein.
                </p>
              </Link>

              <Link
                href="/track-order"
                className="block rounded-xl border p-4 hover:bg-gray-50"
              >
                <p className="font-semibold text-gray-900">Track Order</p>
                <p className="mt-1 text-sm text-gray-600">
                  Shipment aur delivery progress dekhein.
                </p>
              </Link>

              <Link
                href="/returns"
                className="block rounded-xl border p-4 hover:bg-gray-50"
              >
                <p className="font-semibold text-gray-900">
                  Returns & Refunds
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Return eligibility aur request status check karein.
                </p>
              </Link>

              <Link
                href="/shipping"
                className="block rounded-xl border p-4 hover:bg-gray-50"
              >
                <p className="font-semibold text-gray-900">
                  Shipping Information
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Delivery aur shipping details padhein.
                </p>
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Send a Support Query
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Apni query submit karne ke liye WhatsApp ya Email select karein.
              Message bhejne se pehle aap use review kar sakte hain.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="subject"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Query type
                </label>

                <select
                  id="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                >
                  <option>Order / Delivery</option>
                  <option>Payment</option>
                  <option>Returns / Refunds</option>
                  <option>Account / Login</option>
                  <option>Product / Quality</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="orderId"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Order ID (optional)
                </label>

                <input
                  id="orderId"
                  type="text"
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  maxLength={120}
                  placeholder="Enter Order ID"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Your message
                </label>

                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="Apni problem detail mein batayein..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />

                <p className="mt-1 text-right text-xs text-gray-500">
                  {message.length}/2000
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
              >
                Continue to WhatsApp
              </button>

              <button
                type="button"
                onClick={handleEmailSubmit}
                disabled={message.trim().length < 10}
                className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send via Email
              </button>
            </form>
          </section>
        </div>

        <footer className="mt-8 rounded-xl border bg-white p-5 text-center">
          <p className="text-sm text-gray-600">
            ANJIVO Customer Support
          </p>

          <p className="mt-2 text-sm font-medium text-gray-900">
            WhatsApp: +91 9219495647
          </p>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-1 inline-block text-sm text-blue-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>

          <p className="mt-4 text-xs text-gray-500">
            Please apna password, OTP ya payment PIN support message mein
            share na karein.
          </p>
        </footer>
      </div>
    </main>
  );
}
