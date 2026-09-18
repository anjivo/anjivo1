import { categories } from "@/data/categories";

export default function Categories() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">

      <div className="mb-8">
        <h2 className="text-3xl font-black">
          Shop by Category
        </h2>

        <p className="mt-2 text-gray-500">
          Retail aur wholesale products explore karein.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <div
            key={category.name}
            className="rounded-2xl border p-6 text-center transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-4xl">
              {category.icon}
            </div>

            <h3 className="mt-3 font-bold">
              {category.name}
            </h3>
          </div>
        ))}
      </div>

    </section>
  );
}
