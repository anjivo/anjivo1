
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
      "This policy describes the general process for order cancellations, return requests, replacements and refunds for purchases made through ANJIVO.",
      "Eligibility may depend on the product category, product condition, order status, applicable seller terms and consumer protection laws.",
    ],
  },
  {
    title: "2. Order Cancellation",
    paragraphs: [
      "Customers may request cancellation through the available account or support options. Whether cancellation is possible depends on the order's fulfilment status and applicable rules.",
      "Orders that have already been dispatched or delivered may need to be handled through the return process instead.",
    ],
  },
  {
    title: "3. Return Eligibility",
    paragraphs: [
      "If a product is damaged, defective, incorrect or materially different from its description, customers should submit a return or resolution request with relevant details and supporting photographs where appropriate.",
      "For change-of-mind returns, eligibility, timelines and product-condition requirements must follow the applicable product terms and published return rules.",
      "Products that cannot legally or reasonably be returned for hygiene, safety, personalisation or other legitimate reasons may have specific restrictions. Any applicable restriction should be communicated clearly before purchase.",
    ],
  },
  {
    title: "4. How to Request a Return",
    paragraphs: [
      "Open your account and locate the relevant order if return functionality is available. Select the relevant item, explain the reason and provide the requested supporting information.",
      "If the account does not offer a return option, contact ANJIVO support with your order number and a description of the issue.",
      "Submitting a request does not automatically mean it has been approved. We may need to review the request and confirm the next steps.",
    ],
  },
  {
    title: "5. Product Condition and Inspection",
    paragraphs: [
      "Where inspection is reasonably required, the product may need to be made available for verification or collection.",
      "Customers should retain the product, accessories, packaging and invoice where reasonably possible until the request is resolved. This does not remove any rights available under applicable law.",
    ],
  },
  {
    title: "6. Refund Processing",
    paragraphs: [
      "Approved refunds will be processed using the original payment method where feasible, or another lawful and agreed method where appropriate.",
      "The time taken for a refund to appear may depend on the payment provider, bank and transaction method. Any confirmed processing timeline should be communicated to the customer.",
    ],
  },
  {
    title: "7. Cash on Delivery Orders",
    paragraphs: [
      "For eligible Cash on Delivery orders, the customer may be asked to provide verified bank or other permitted refund details if a refund is approved.",
      "Customers should share refund information only through an official and secure support channel. ANJIVO will not require a customer to disclose an account password or OTP to issue a refund.",
    ],
  },
  {
    title: "8. Replacements and Exchanges",
    paragraphs: [
      "Where a replacement or exchange is offered, it depends on product availability and the resolution agreed for the particular order.",
      "If a replacement is unavailable, the customer may be offered another appropriate resolution in accordance with applicable law and the circumstances of the purchase.",
    ],
  },
  {
    title: "9. Delivery Charges",
    paragraphs: [
      "The treatment of delivery charges, return shipping and any other fees depends on the reason for the return, the displayed order terms and applicable consumer law.",
      "Charges should not be withheld where doing so would violate applicable law or a binding customer entitlement.",
    ],
  },
  {
    title: "10. Request Status and Disputes",
    paragraphs: [
      "Customers should retain their order number and any support correspondence. If a request is delayed or the proposed resolution is disputed, contact ANJIVO support for review.",
      "Nothing in this policy limits statutory consumer rights or access to remedies available under applicable law.",
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
            Effective date: 28 October 2026
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
                Return eligibility and processing times depend on the
                applicable product terms, order circumstances and applicable
                law. Please check the product and order details before
                submitting a request.
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
