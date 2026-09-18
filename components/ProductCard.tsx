import Image from "next/image";

type ProductCardProps = {
  name: string;
  category: string;
  price: number;
  wholesalePrice: number;
  oldPrice?: number;
  rating?: number;
  reviews?: number;
  image: string;
  badge?: string;
  seller?: string;
  moq?: number;
  stock?: number;
  verifiedSeller?: boolean;
};

export default function ProductCard({
  name,
  category,
  price,
  wholesalePrice,
  oldPrice,
  rating,
  reviews,
  image,
  badge,
  seller,
  moq = 10,
  stock,
  verifiedSeller = true,
}: ProductCardProps) {
  const discount =
    oldPrice && oldPrice > price
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0;

  const isImage =
    image.startsWith("/") ||
    image.startsWith("http://") ||
    image.startsWith("https://");

  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-black transition duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-xl">

      {/* ================= PRODUCT IMAGE ================= */}
      <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gray-100 sm:h-52">

        {/* Badge */}
        {badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            {badge}
          </span>
        )}

        {/* Discount */}
        {discount > 0 && (
          <span className="absolute bottom-3 left-3 z-10 rounded-md bg-white px-2 py-1 text-[10px] font-black text-gray-900 shadow-sm">
            {discount}% OFF
          </span>
        )}

        {/* Wishlist */}
        <button
          type="button"
          aria-label={`Add ${name} to wishlist`}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg shadow-sm transition hover:scale-110 hover:bg-black hover:text-white"
        >
          ♡
        </button>

        {/* Product Image / Emoji */}
        {isImage ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="text-7xl transition duration-500 group-hover:scale-110">
            {image}
          </div>
        )}

        {/* Quick View */}
        <button
          type="button"
          className="absolute bottom-3 right-3 hidden rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold shadow-sm backdrop-blur transition hover:bg-black hover:text-white sm:block"
        >
          Quick View
        </button>
      </div>

      {/* ================= PRODUCT INFO ================= */}
      <div className="p-3.5 sm:p-4">

        {/* Category */}
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {category}
          </p>

          {verifiedSeller && (
            <span className="shrink-0 text-[9px] font-bold text-gray-500">
              ✓ Verified
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="mt-1.5 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-gray-900">
          {name}
        </h3>

        {/* ================= RATING ================= */}
        {rating !== undefined && (
          <div className="mt-2 flex items-center gap-1.5">

            <span className="rounded-md bg-gray-100 px-1.5 py-1 text-[10px] font-black">
              ★ {rating}
            </span>

            {reviews !== undefined && (
              <span className="text-[10px] text-gray-400">
                ({reviews.toLocaleString()})
              </span>
            )}

          </div>
        )}

        {/* ================= RETAIL PRICE ================= */}
        <div className="mt-3 flex flex-wrap items-center gap-2">

          <span className="text-lg font-black text-gray-950">
            ₹{price.toLocaleString("en-IN")}
          </span>

          {oldPrice !== undefined && (
            <span className="text-xs text-gray-400 line-through">
              ₹{oldPrice.toLocaleString("en-IN")}
            </span>
          )}

          {discount > 0 && (
            <span className="text-[10px] font-black text-gray-700">
              {discount}% OFF
            </span>
          )}

        </div>

        {/* ================= WHOLESALE PRICE ================= */}
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">

          <div className="flex items-center justify-between gap-2">

            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                Wholesale
              </p>

              <p className="mt-0.5 text-sm font-black text-gray-950">
                ₹{wholesalePrice.toLocaleString("en-IN")}
                <span className="ml-1 text-[10px] font-medium text-gray-500">
                  / piece
                </span>
              </p>
            </div>

            <div className="rounded-lg bg-white px-2 py-1 text-right shadow-sm">
              <p className="text-[8px] font-bold uppercase text-gray-400">
                MOQ
              </p>

              <p className="text-[10px] font-black">
                {moq}
              </p>
            </div>

          </div>

        </div>

        {/* ================= SELLER ================= */}
        {seller && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">

            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
              🏪
            </span>

            <span className="truncate">
              {seller}
            </span>

            {verifiedSeller && (
              <span className="font-bold text-gray-700">
                ✓
              </span>
            )}

          </div>
        )}

        {/* ================= STOCK ================= */}
        {stock !== undefined && (
          <div className="mt-2">

            {stock <= 10 ? (
              <p className="text-[10px] font-bold text-gray-700">
                ⚡ Only {stock} left
              </p>
            ) : (
              <p className="text-[10px] font-medium text-gray-400">
                In stock
              </p>
            )}

          </div>
        )}

        {/* ================= ACTION ================= */}
        <button
          type="button"
          className="mt-3 w-full rounded-xl bg-black py-3 text-xs font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
        >
          Add to Cart
        </button>

      </div>
    </article>
  );
}
