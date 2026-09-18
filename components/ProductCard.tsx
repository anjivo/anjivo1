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
}: ProductCardProps) {
  const discount = oldPrice
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  return (
    <div className="group overflow-hidden rounded-2xl border bg-white text-black transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative flex h-44 items-center justify-center bg-gray-100">
        {badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}

        <button className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition hover:scale-110">
          ♡
        </button>

        <div className="text-7xl transition duration-300 group-hover:scale-110">
          {image}
        </div>
      </div>

      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {category}
        </p>

        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-bold">
          {name}
        </h3>

        {rating && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-bold">
              ★ {rating}
            </span>

            {reviews && (
              <span className="text-gray-400">
                ({reviews.toLocaleString()})
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">
              ₹{price}
            </span>

            {oldPrice && (
              <span className="text-xs text-gray-400 line-through">
                ₹{oldPrice}
              </span>
            )}

            {discount > 0 && (
              <span className="text-[10px] font-bold">
                {discount}% OFF
              </span>
            )}
          </div>

          <div className="mt-1 text-[11px]">
            <span className="font-bold">
              ₹{wholesalePrice}
            </span>{" "}
            <span className="text-gray-500">
              wholesale
            </span>
          </div>
        </div>

        <button className="mt-3 w-full rounded-xl bg-black py-2.5 text-xs font-bold text-white transition hover:bg-gray-800">
          Add to Cart
        </button>
      </div>
    </div>
  );
}
