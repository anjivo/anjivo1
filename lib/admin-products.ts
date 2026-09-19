import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
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
  const productsRef =
    collection(db, "products");

  const productRef = await addDoc(
    productsRef,
    {
      ...data,

      sellerId: adminId,
      sellerName: "ANJIVO Official",
      sellerVerified: true,

      status:
        data.status || "active",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return productRef.id;
}

export async function getAdminProduct(
  productId: string
): Promise<Product | null> {
  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot =
    await getDoc(productRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<
      Product,
      "id"
    >),
  };
}

export async function updateAdminProduct(
  productId: string,
  data: Partial<
    Omit<
      Product,
      "id" | "createdAt" | "updatedAt"
    >
  >
): Promise<void> {
  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot =
    await getDoc(productRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Product not found."
    );
  }

  /*
   * Admin product edit ke through
   * seller ownership change nahi hogi.
   */
  const safeData = {
    ...data,
  };

  delete (
    safeData as Partial<Product>
  ).sellerId;

  await updateDoc(
    productRef,
    {
      ...safeData,

      updatedAt:
        serverTimestamp(),
    }
  );
}

export async function deleteAdminProduct(
  productId: string
): Promise<void> {
  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot =
    await getDoc(productRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Product not found."
    );
  }

  await deleteDoc(productRef);
}
