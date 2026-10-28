
import Link from "next/link";

const shippingSections = [
  {
    title: "1. Delivery Coverage",
    content:
      "ANJIVO par delivery availability aapke delivery address, serviceable PIN code aur local delivery capacity par depend karti hai. Filhaal website par order place karne se pehle apne address ki serviceability confirm karein.",
  },
  {
    title: "2. Estimated Delivery Time",
    content:
      "Delivery ka estimated time order confirmation, product availability, seller dispatch aur delivery location par depend karta hai. Checkout par ya order confirmation ke samay dikhaya gaya estimate follow karein.",
  },
  {
    title: "3. Shipping Charges",
    content:
      "Shipping charges order value, delivery distance, product aur applicable delivery rules ke hisaab se vary kar sakte hain. Order confirm karne se pehle checkout par dikhaye gaye final shipping charges check karein.",
  },
  {
    title: "4. Order Processing and Dispatch",
    content:
      "Order place hone ke baad uski details verify ki jaati hain. Product availability aur order processing ke baad order dispatch kiya jaata hai. Dispatch aur tracking details available hone par customer apne account mein order status check kar sakta hai.",
  },
  {
    title: "5. Track Your Shipment",
    content:
      "Apne order ka current status dekhne ke liye Track Order page par jaayein. Agar courier tracking details available hain, toh unka link order details mein dikhaya ja sakta hai.",
  },
  {
    title: "6. Delivery Issues",
    content:
      "Agar delivery mein delay ho, address galat ho ya delivery attempt fail ho, toh apne order details check karein aur support team se contact karein.",
  },
  {
    title: "7. Returns and Refunds",
    content:
      "Return eligibility, return requests aur refunds applicable return policy aur order status ke mutabik handle kiye jaate hain. Request karne se pehle Returns & Refunds page check karein.",
  },
];

export default function ShippingPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-2xl bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            ANJIVO Customer Information
          </p>

          <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
            Shipping Information
          </h1>

          <p className="mt-4 leading-7 text-gray-600">
            Yahan delivery coverage, shipping charges, dispatch aur order
            tracking se related important information padhein.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              My Orders
            </Link>

            <Link
              href="/track-order"
              className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              Track Order
            </Link>
          </div>
        </header>

        <section className="mt-6 space-y-4">
          {shippingSections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7"
            >
              <h2 className="text-lg font-bold text-gray-900">
                {section.title}
              </h2>

              <p className="mt-3 leading-7 text-gray-600">
                {section.content}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Need Help With Delivery?
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            Apne order number aur registered account details ke saath
            support team se contact karein.
          </p>

          <Link
            href="/contact"
            className="mt-5 inline-flex rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100"
          >
            Contact Support
          </Link>
        </section>
      </div>
    </main>
  );
}
