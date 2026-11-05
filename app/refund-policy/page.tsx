
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund & Return Policy | ANJIVO",
  description:
    "Understand ANJIVO order cancellations, returns, replacements and refund procedures.",
};

const sections = [
  {
    title: "1. Scope of This Policy",
    paragraphs: [
      "This policy explains how customers can request order cancellation, returns, replacements and refunds for eligible purchases made through ANJIVO.",
      "Return requests are reviewed against the order details, product condition, reason for return and the applicable consumer protection laws. Submitting a request does not guarantee approval.",
    ],
  },
  {
    title: "2. Order Cancellation",
    paragraphs: [
      "You may request cancellation from your account or by contacting ANJIVO support. Cancellation depends on the current order and fulfilment status.",
      "If an order has already been dispatched, cancellation may no longer be possible. After delivery, eligible issues should be submitted through the return process.",
    ],
  },
  {
    title: "3. Return Window — 3 Days (72 Hours)",
    paragraphs: [
      "A return request must be submitted within 72 hours (3 days) from the recorded delivery date and time of the order.",
      "The return option is available only for an order marked as delivered and while the 72-hour return window is open. Requests submitted after this period may not be accepted, except where a different period or remedy is required by applicable law or specifically communicated for the product.",
      "If the delivery timestamp is not visible in your account or the return option is unavailable, contact ANJIVO support promptly and share your order number.",
    ],
  },
  {
    title: "4. Eligible Return Reasons",
    paragraphs: [
      "You may submit a return request for an eligible item for reasons such as damaged item, wrong item received, missing item, quality issue, size issue or item not as described. An 'Other' option may also be available so you can explain the issue.",
      "Please select the correct item and quantity, describe the issue clearly and upload relevant photographs where requested. For a missing-item claim, explain which item or quantity was missing.",
      "Product-specific exclusions or special conditions, if applicable, should be disclosed on the product page or before purchase. Nothing in this policy removes rights available under applicable law.",
    ],
  },
  {
    title: "5. How to Submit a Return Request",
    paragraphs: [
      "Sign in to your ANJIVO account and open My Orders. Select the delivered order, choose the item and quantity you want to return, select a reason and provide the requested description and supporting images.",
      "Review the details before submitting. You can view the request status from the relevant order or return details where that feature is available.",
      "If you cannot submit a request through your account, contact ANJIVO support within the 72-hour return window with your order number, item details and a description of the issue.",
    ],
  },
  {
    title: "6. Return Review, Approval and Pickup",
    paragraphs: [
      "After submission, ANJIVO will review the request and may ask for additional information or photographs. The request can be approved, rejected or referred for further review based on the available information and applicable rules.",
      "If approved, the customer will be informed of the next return or pickup steps. Keep the product ready with its accessories, tags, invoice and original packaging where reasonably possible.",
      "A return request is not considered completed merely because it has been submitted or approved. The item may need to be collected and received before inspection and refund review.",
    ],
  },
  {
    title: "7. Product Inspection and Quality Check (QC)",
    paragraphs: [
      "After the returned item is received, it may undergo a quality check to verify the reported issue, item identity, quantity and condition.",
      "The QC result is considered before refund approval. If the item or claim does not meet the applicable return conditions, the request may be rejected or handled through another appropriate resolution. The customer will be informed of the outcome.",
      "Customers should not send a product to an address that has not been confirmed by ANJIVO support or through the official return instructions.",
    ],
  },
  {
    title: "8. Refund Approval and Processing",
    paragraphs: [
      "A refund is considered only after the return has been reviewed, the returned item has been received where required, the quality check has been completed and the refund has been approved.",
      "For eligible online prepaid orders, ANJIVO may initiate the refund through Cashfree to the original payment method, subject to payment-provider support. The refund is not complete until the payment provider confirms the transaction.",
      "The time for the credited amount to appear in your account depends on the payment provider, bank and original payment method. ANJIVO will share available refund or transaction information when it is received.",
      "A return request, pickup, item receipt or internal approval alone does not mean that the refund has been credited.",
    ],
  },
  {
    title: "9. Cash on Delivery (COD) Orders",
    paragraphs: [
      "Cashfree online payment refunds do not apply to orders paid in cash on delivery. If a COD return is eligible and approved, ANJIVO support may contact you to arrange a permitted refund method, such as a verified bank transfer.",
      "You may be asked to provide the minimum details needed to process the approved refund through an official support channel. Never share your UPI PIN, card PIN, banking password or OTP with anyone claiming to process a refund.",
    ],
  },
  {
    title: "10. Replacements, Exchanges and Delivery Charges",
    paragraphs: [
      "A replacement or exchange may be offered where appropriate and subject to product availability and the resolution agreed for the order. If a replacement is unavailable, an eligible refund or another lawful resolution may be considered.",
      "The treatment of original delivery charges, return pickup charges and other fees depends on the reason for return, the order terms and applicable consumer law. Any applicable charge or deduction will be communicated as required.",
    ],
  },
  {
    title: "11. Return Status, Rejection and Disputes",
    paragraphs: [
      "The return process may include these stages: request submitted, review/approval, pickup, item received, quality check, refund approval, refund initiation and provider confirmation.",
      "If your request is rejected, delayed or the QC result is disputed, contact ANJIVO support with your order number and return request details so the matter can be reviewed.",
      "Please retain the order number, return request information, photographs and support correspondence until the matter is resolved.",
    ],
  },
  {
    title: "12. Customer Rights and Support",
    paragraphs: [
      "This policy is intended to explain ANJIVO's process and does not limit any statutory rights or remedies available to customers under applicable Indian law.",
      "For help with a return or refund, use the Contact Support page and keep your order number ready.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-black"
          >
            <span aria-hidden="true">←</span>
            Back to ANJIVO
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="rounded-2xl bg-black px-5 py-8 text-white sm:px-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">
            Customer information
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Refund &amp; Return Policy
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
            Learn how to request order cancellations, returns, replacements
            and refunds for eligible purchases.
          </p>

          <p className="mt-4 text-xs text-gray-400">
            Effective date: 5 November 2026
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-24">
            <h2 className="text-sm font-bold">On this page</h2>

            <nav aria-label="Refund policy sections" className="mt-3">
              <ul className="space-y-2">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#refund-section-${index + 1}`}
                      className="block text-xs leading-5 text-gray-600 transition hover:text-black"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-6 text-amber-900">
                Important: Submit your return request within 72 hours (3 days)
                from the recorded delivery date and time. Returns are subject
                to review, pickup where required, product receipt and quality
                check before refund approval.
              </p>
            </div>

            <div className="mt-7 space-y-8">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={`refund-section-${index + 1}`}
                  className="scroll-mt-24 border-b border-gray-100 pb-7 last:border-0 last:pb-0"
                >
                  <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                    {section.title}
                  </h2>

                  <div className="mt-3 space-y-3">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="break-words text-sm leading-7 text-gray-600"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-8 rounded-xl bg-gray-50 p-4 sm:p-5">
              <h2 className="text-base font-bold">
                Need help with an order?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Keep your order number ready when contacting support so the
                team can review your request.
              </p>

              <Link
                href="/account/orders"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                View My Orders
              </Link>

              <Link
                href="/contact"
                className="ml-0 mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-800 transition hover:bg-white sm:ml-3 sm:mt-0"
              >
                Contact Support
              </Link>
            </div>
          </article>
        </div>

        <nav
          aria-label="Other legal pages"
          className="mt-6 flex flex-wrap gap-x-5 gap-y-3 rounded-2xl border border-gray-200 bg-white p-5 text-sm"
        >
          <Link href="/privacy" className="font-semibold underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="font-semibold underline">
            Terms &amp; Conditions
          </Link>
          <Link href="/seller-policy" className="font-semibold underline">
            Seller Policy
          </Link>
        </nav>
      </div>
    </main>
  );
}
