import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Product } from "@/types/product";

export async function createAdminProduct(
  adminId: string,
  data: Omit<
    Product,
    "id" | "createdAt" | "updatedAt"
  >
): Promise<string> {
  const productsRef = collection(
    db,
    "products"
  );

  const productRef = await addDoc(
    productsRef,
    {
      ...data,

      /*
       * Admin-created products are owned
       * by ANJIVO/Admin.
       */
      sellerId: adminId,
      sellerName: "ANJIVO Official",
      sellerVerified: true,

      /*
       * Admin can publish the product
       * directly.
       */
      status: data.status || "active",

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return productRef.id;
}
