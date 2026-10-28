
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Seller Policy | ANJIVO",
  description:
    "Review seller eligibility, product listing, order fulfilment and marketplace rules on ANJIVO.",
};

const sections = [
  {
    title: "1. Seller Eligibility and Registration",
    paragraphs: [
      "Individuals and businesses may apply to sell through ANJIVO using the registration process provided on the platform.",
      "Sellers must provide accurate business, contact, bank and tax information where requested or required by applicable law. ANJIVO may request documents to verify seller identity or eligibility.",
    ],
  },
  {
    title: "2. Seller Account Responsibility",
    paragraphs: [
      "Sellers are responsible for maintaining accurate account information and protecting their login credentials.",
      "Seller accounts must not be transferred, shared or used for unauthorised activity. Suspected account compromise should be reported promptly.",
    ],
  },
  {
    title: "3. Product Listings",
    paragraphs: [
      "Sellers must provide accurate product titles, descriptions, photographs, sizes, colours, specifications, prices and stock quantities.",
      "Listings must not be misleading or omit material information that could affect a customer's purchasing decision.",
      "Sellers must have the necessary rights and authorisations to list and sell their products, including permission to use relevant images, trademarks and other protected materials.",
    ],
  },
  {
    title: "4. Product Safety and Prohibited Items",
    paragraphs: [
      "Sellers must comply with applicable product safety, labelling, consumer protection, intellectual property and other relevant laws.",
      "Counterfeit, stolen, unlawful, restricted or otherwise prohibited products must not be listed. Products requiring licences or special authorisations may only be listed when all applicable requirements are satisfied.",
    ],
  },
  {
    title: "5. Pricing, Discounts and Taxes",
    paragraphs: [
      "Sellers must maintain accurate prices, available discounts and product information. Any applicable taxes or charges must be represented in accordance with the platform's checkout design and applicable law.",
      "Sellers are responsible for their own legal, tax and invoicing obligations to the extent applicable to their business and transactions.",
    ],
  },
  {
    title: "6. Inventory and Order Acceptance",
    paragraphs: [
      "Sellers must keep stock information current and take reasonable steps to prevent customers from ordering unavailable products.",
      "Orders must be handled through the applicable ANJIVO workflow. Sellers should not falsely mark an order as dispatched, delivered or cancelled.",
    ],
  },
  {
    title: "7. Order Fulfilment and Shipping",
    paragraphs: [
      "Sellers must prepare accepted orders within the applicable processing period and provide accurate fulfilment information.",
      "Packaging must be suitable for the product, and any tracking or handover details required by the platform must be entered accurately.",
      "Delivery estimates and fulfilment obligations should follow the applicable order terms and any agreed seller service requirements.",
    ],
  },
  {
    title: "8. Returns, Refunds and Customer Complaints",
    paragraphs: [
      "Sellers must cooperate with legitimate customer support, return, replacement and refund investigations.",
      "Requests involving damaged, defective, incorrect or materially misdescribed products must be handled in accordance with the applicable platform policies and consumer law.",
      "Sellers must not mislead customers about their rights or obstruct a lawful complaint or resolution process.",
    ],
  },
  {
    title: "9. Fees, Commissions and Settlements",
    paragraphs: [
      "Any applicable platform fees, commissions, payment deductions and settlement arrangements must be communicated through the relevant seller agreement or platform interface.",
      "Do not assume a particular commission rate or settlement period unless it has been expressly confirmed in the applicable agreement or official seller dashboard.",
    ],
  },
  {
    title: "10. Seller Conduct",
    paragraphs: [
      "Sellers must not create fraudulent orders, manipulate reviews, misuse customer information, interfere with another seller's account or attempt to circumvent platform security.",
      "Customer information obtained through ANJIVO may only be used for legitimate order fulfilment, support and other lawful purposes.",
    ],
  },
  {
    title: "11. Monitoring and Enforcement",
    paragraphs: [
      "ANJIVO may review listings, investigate reported violations and request supporting documents where reasonably necessary.",
      "Depending on the circumstances and applicable law, violations may result in a listing being corrected or removed, a seller account being restricted or suspended, or further action being taken.",
      "Where appropriate, sellers should have a reasonable way to raise a concern or request a review of an enforcement decision.",
    ],
  },
  {
    title: "12. Changes to This Policy",
    paragraphs: [
      "ANJIVO may update this policy to reflect changes in its services, seller workflows or legal requirements. The updated policy will be published on this page.",
      "Any separate seller agreement or mandatory legal requirement continues to apply where relevant.",
    ],
  },
];

export default function SellerPolicyPage() {
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
            Marketplace information
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Seller Policy
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
            Rules and responsibilities for sellers listing products and
            fulfilling orders through ANJIVO.
          </p>

          <p className="mt-4 text-xs text-gray-400">
            Effective date: 28 October 2026
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-24">
            <h2 className="text-sm font-bold">On this page</h2>

            <nav aria-label="Seller policy sections" className="mt-3">
              <ul className="space-y-2">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#seller-section-${index + 1}`}
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
            <p className="text-sm leading-7 text-gray-600">
              Sellers are expected to read this policy alongside any
              applicable seller agreement, product-specific requirements and
              other published ANJIVO policies.
            </p>

            <div className="mt-7 space-y-8">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={`seller-section-${index + 1}`}
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
              <h2 className="text-base font-bold">Ready to sell?</h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Visit the seller registration page to review the available
                onboarding process.
              </p>

              <Link
                href="/seller/register"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                Seller Registration
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
          <Link href="/refund-policy" className="font-semibold underline">
            Refund Policy
          </Link>
        </nav>
      </div>
    </main>
  );
}
