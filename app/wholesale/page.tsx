import { redirect } from "next/navigation";

/**
 * The header and wholesale CTA use /wholesale.
 * Send customers to the catalogue with wholesale pricing selected.
 */
export default function WholesalePage() {
  redirect("/products?pricing=wholesale");
}
