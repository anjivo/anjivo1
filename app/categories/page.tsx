
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getCategories } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let categories;

  try {
    categories = await getCategories();
  } catch (error) {
    console.error("Failed to load categories:", error);

    return (
      <>
        <Header />
        <main className="mx-auto min-h-[50vh] max-w-7xl px-4 py-16">
          <h1 className="text-3xl font-black">All Categories</h1>
          <p className="mt-4 text-red-600">
            Categories load nahi ho paayi. Please refresh karke try karein.
          </p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Explore ANJIVO
        </p>

        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          All Categories
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          Browse categories and discover products across ANJIVO.
        </p>

        {categories.length === 0 ? (
          <p className="mt-8 rounded-xl border bg-white p-6 text-gray-600">
            No active categories available.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${encodeURIComponent(category.id)}`}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-black hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
                  🛍️
                </div>

                <h2 className="mt-4 font-bold">
                  {category.name}
                </h2>

                {category.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-gray-500">
                    {category.description}
                  </p>
                )}

                <p className="mt-4 text-xs font-bold">
                  Explore Products →
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
