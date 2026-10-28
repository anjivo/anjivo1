
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions | ANJIVO",
  description:
    "Read the terms governing the use of the ANJIVO marketplace.",
};

const sections = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "These Terms & Conditions govern your access to and use of the ANJIVO website and related services.",
      "By accessing or using ANJIVO, you agree to these terms and applicable laws. If you do not agree, please discontinue using the services.",
    ],
  },
  {
    title: "2. About ANJIVO",
    paragraphs: [
      "ANJIVO provides an online platform for browsing products and accessing related shopping services. The exact role of ANJIVO in a particular transaction depends on the product, seller and service involved.",
      "Product availability, fulfilment arrangements and applicable seller details should be checked on the relevant product and checkout pages.",
    ],
  },
  {
    title: "3. Customer Accounts",
    paragraphs: [
      "You are responsible for providing accurate account and contact information and for maintaining the confidentiality of your login credentials.",
      "You should promptly report suspected unauthorised access to your account. We may take reasonable steps to protect accounts and platform security.",
    ],
  },
  {
    title: "4. Product Information and Pricing",
    paragraphs: [
      "Product descriptions, photographs, prices, sizes, colours and stock information are provided to help customers make informed decisions. Displayed information may occasionally require correction or updating.",
      "The price and applicable charges shown at checkout should be reviewed before an order is submitted. Any legally applicable taxes and delivery charges will be handled according to the displayed terms and applicable law.",
    ],
  },
  {
    title: "5. Orders and Acceptance",
    paragraphs: [
      "Submitting an order is a request to purchase the selected products. Order confirmation, acceptance, fulfilment and cancellation may depend on stock availability, payment status, address validation and applicable platform rules.",
      "If an order cannot be fulfilled, the customer should be informed through an appropriate communication channel and any eligible refund handled under the applicable refund policy.",
    ],
  },
  {
    title: "6. Payments and Cash on Delivery",
    paragraphs: [
      "Available payment methods will be displayed during checkout. Third-party payment providers may apply their own terms and security procedures.",
      "Where Cash on Delivery is offered, customers must provide accurate delivery details and cooperate with reasonable delivery verification procedures.",
    ],
  },
  {
    title: "7. Shipping and Delivery",
    paragraphs: [
      "Delivery estimates are indicative and may be affected by location, availability, weather, logistics and other circumstances beyond reasonable control.",
      "Customers should provide a complete delivery address and reachable phone number. Any delivery restrictions or additional charges should be displayed or communicated as applicable.",
    ],
  },
  {
    title: "8. Returns, Refunds and Cancellations",
    paragraphs: [
      "Return eligibility, cancellation conditions, refund processing and any product-specific restrictions are governed by the applicable Refund Policy and the information shown for the order.",
      "Nothing in these terms is intended to remove rights that consumers cannot legally waive under applicable law.",
    ],
  },
  {
    title: "9. Prohibited Conduct",
    paragraphs: [
      "You must not misuse the website, interfere with its operation, attempt unauthorised access, submit fraudulent orders, abuse other users or upload unlawful or malicious content.",
      "We may investigate suspected misuse and take proportionate action where permitted by law and our applicable policies.",
    ],
  },
  {
    title: "10. Intellectual Property",
    paragraphs: [
      "Website content, branding, interface elements and other materials may be protected by intellectual property laws. You may not reproduce or commercially exploit protected materials without appropriate permission.",
      "Product images and trademarks belonging to sellers or other rights holders remain subject to their respective rights.",
    ],
  },
  {
    title: "11. Limitation of Liability",
    paragraphs: [
      "To the extent permitted by applicable law, ANJIVO is not responsible for indirect losses arising from use of the platform where such exclusion is legally permitted.",
      "These terms do not exclude or limit liability where applicable law prohibits such exclusion or limitation, including any non-waivable consumer rights.",
    ],
  },
  {
    title: "12. Changes to These Terms",
    paragraphs: [
      "We may revise these terms to reflect changes in the platform, business operations or legal requirements. Updated terms will be published on this page.",
      "Your continued use of the services after an update takes effect will be subject to applicable law and any required notice or consent.",
    ],
  },
  {
    title: "13. Governing Law and Disputes",
    paragraphs: [
      "These terms are subject to applicable laws of India. Disputes will be handled by the competent authorities or courts with jurisdiction under applicable law.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-gray-600 hover:text-black"
          >
            <span aria-hidden="true">←</span>
            Back to ANJIVO
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="rounded-2xl bg-black px-5 py-8 text-white sm:px-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">
            Legal information
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Terms &amp; Conditions
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
            These terms describe the general rules for using ANJIVO and its
            marketplace services.
          </p>

          <p className="mt-4 text-xs text-gray-400">
            Effective date: 28 October 2026
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-24">
            <h2 className="text-sm font-bold">On this page</h2>

            <nav aria-label="Terms sections" className="mt-3">
              <ul className="space-y-2">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#terms-section-${index + 1}`}
                      className="block text-xs leading-5 text-gray-600 hover:text-black"
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
              Please read these terms before placing an order or using
              platform features. Product-specific conditions and other
              published policies may also apply.
            </p>

            <div className="mt-7 space-y-8">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={`terms-section-${index + 1}`}
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
              <h2 className="text-base font-bold">Need help?</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                For questions about these terms, contact ANJIVO through the
                support channel published on the website.
              </p>

              <Link
                href="/contact"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white hover:bg-gray-800"
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
          <Link href="/refund-policy" className="font-semibold underline">
            Refund Policy
          </Link>
          <Link href="/seller-policy" className="font-semibold underline">
            Seller Policy
          </Link>
        </nav>
      </div>
    </main>
  );
}
