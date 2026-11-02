
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/products/",
          "/categories/",
        ],
        disallow: [
          "/admin/",
          "/seller/",
          "/account/",
          "/api/",
          "/checkout/",
          "/cart/",
          "/login",
          "/register",
          "/verify",
          "/order-success/",
        ],
      },
    ],

    sitemap: "https://anjivo.online/sitemap.xml",

    host: "https://anjivo.online",
  };
}
