export default function Footer() {
  return (
    <footer className="mt-10 border-t bg-gray-950 text-white">

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">

        <div>
          <h2 className="text-2xl font-black">
            ANJIVO
          </h2>

          <p className="mt-3 text-sm text-gray-400">
            Wholesale aur retail shopping ka ek platform.
          </p>
        </div>

        <div>
          <h3 className="font-bold">Shop</h3>

          <div className="mt-4 space-y-2 text-sm text-gray-400">
            <p>All Products</p>
            <p>Wholesale</p>
            <p>Categories</p>
          </div>
        </div>

        <div>
          <h3 className="font-bold">Help</h3>

          <div className="mt-4 space-y-2 text-sm text-gray-400">
            <p>Contact Us</p>
            <p>Shipping</p>
            <p>Returns</p>
          </div>
        </div>

        <div>
          <h3 className="font-bold">Business</h3>

          <div className="mt-4 space-y-2 text-sm text-gray-400">
            <p>Become a Supplier</p>
            <p>Wholesale Account</p>
          </div>
        </div>

      </div>

      <div className="border-t border-gray-800 px-4 py-5 text-center text-sm text-gray-500">
        © 2026 ANJIVO. All rights reserved.
      </div>

    </footer>
  );
}
