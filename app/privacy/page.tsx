
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ANJIVO",
  description:
    "Learn how ANJIVO handles personal information, account data, orders and privacy.",
};

const sections = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      "When you use ANJIVO, we may collect information you provide, such as your name, email address, phone number, delivery address and account details.",
      "We may also process order details, seller information, customer support messages and technical information needed to operate and secure the website.",
    ],
  },
  {
    title: "2. How We Use Information",
    paragraphs: [
      "We use information to create and manage accounts, process orders, arrange deliveries, provide customer support, manage seller services and improve website functionality.",
      "We may use your contact information for service-related messages. Promotional communications should be sent in accordance with applicable law and your communication preferences.",
    ],
  },
  {
    title: "3. Orders and Marketplace Information",
    paragraphs: [
      "Information necessary to fulfil an order may be shared with the relevant seller, delivery personnel and service providers involved in completing that order.",
      "We aim to limit information sharing to what is reasonably necessary for the relevant purpose.",
    ],
  },
  {
    title: "4. Payments and Security",
    paragraphs: [
      "Payments may be handled by third-party payment providers. Their processing of payment information is also subject to their applicable terms and privacy policies.",
      "We use appropriate measures intended to protect account and transaction information. However, no internet transmission or storage system can be guaranteed to be completely secure.",
    ],
  },
  {
    title: "5. Cookies and Technical Data",
    paragraphs: [
      "ANJIVO and its service providers may use cookies or similar technologies where needed for website functionality, preferences, security and performance.",
      "You can manage available cookie and browser permissions through your browser settings. Disabling certain technologies may affect some website features.",
    ],
  },
  {
    title: "6. Data Sharing",
    paragraphs: [
      "We do not intend to sell personal information as a standalone product. Information may be shared with relevant sellers, delivery providers, payment providers, hosting providers or other service providers when necessary to operate the platform, comply with law or protect legitimate rights.",
      "Information may also be disclosed when required by applicable law or a lawful request from an authorised authority.",
    ],
  },
  {
    title: "7. Data Retention",
    paragraphs: [
      "Information is retained for as long as reasonably necessary for the purposes described in this policy, including order fulfilment, customer support, security, dispute resolution and legal or accounting obligations.",
    ],
  },
  {
    title: "8. Your Choices and Requests",
    paragraphs: [
      "Depending on applicable law, you may request access to, correction of or deletion of certain personal information, or raise a concern about how your information is handled.",
      "Some records may need to be retained where required by law or for legitimate operational and dispute-resolution purposes.",
    ],
  },
  {
    title: "9. Children's Privacy",
    paragraphs: [
      "ANJIVO is not intended to be used by children in violation of applicable law. If you believe a child has provided personal information inappropriately, contact us so the matter can be reviewed.",
    ],
  },
  {
    title: "10. Policy Updates",
    paragraphs: [
      "We may update this policy as our services, technology or legal obligations change. The updated version will be published on this page with a revised effective date where appropriate.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-black"
          >
            <span aria-hidden="true">←</span>
            Back to ANJIVO
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="rounded-2xl bg-black px-5 py-8 text-white sm:px-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">
            Legal information
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
            This policy explains how ANJIVO may collect, use, store and share
            information when you use our marketplace.
          </p>

          <p className="mt-4 text-xs text-gray-400">
            Effective date: 28 October 2026
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-24">
            <h2 className="text-sm font-bold">On this page</h2>

            <nav aria-label="Privacy Policy sections" className="mt-3">
              <ul className="space-y-2">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#privacy-section-${index + 1}`}
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
              Please read this policy carefully. By using ANJIVO, you
              acknowledge that you have read this notice. Where consent is
              legally required, we will seek it separately as applicable.
            </p>

            <div className="mt-7 space-y-8">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={`privacy-section-${index + 1}`}
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
                Privacy questions or requests?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Contact ANJIVO through the official support channel published
                on our website. We will need to confirm the details of your
                request before acting on account information.
              </p>

              <Link
                href="/contact"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
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
          <Link className="font-semibold underline" href="/terms">
            Terms & Conditions
          </Link>
          <Link className="font-semibold underline" href="/refund-policy">
            Refund Policy
          </Link>
          <Link className="font-semibold underline" href="/seller-policy">
            Seller Policy
          </Link>
        </nav>
      </div>
    </main>
  );
}
