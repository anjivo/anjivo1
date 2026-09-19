import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type CartItem = {
  productId: string;
  name: string;
  slug: string;

  sellerId: string;
  sellerName?: string;

  image?: string;

  retailPrice: number;
  wholesalePrice: number;

  quantity: number;
  moq: number;

  selectedPrice: number;
  pricingType: "retail" | "wholesale";

  stock: number;
};

export type Cart = {
  userId: string;
  items: CartItem[];
  updatedAt?: unknown;
};


/* =========================================
   GET CART
========================================= */

export async function getCart(
  userId: string
): Promise<Cart> {
  const cartRef = doc(db, "carts", userId);

  const snapshot = await getDoc(cartRef);

  if (!snapshot.exists()) {
    return {
      userId,
      items: [],
    };
  }

  return {
    userId,
    items: Array.isArray(snapshot.data().items)
      ? snapshot.data().items
      : [],
    updatedAt: snapshot.data().updatedAt,
  };
}


/* =========================================
   ADD TO CART
========================================= */

export async function addToCart(
  userId: string,
  item: CartItem
) {
  const cartRef = doc(db, "carts", userId);

  const snapshot = await getDoc(cartRef);

  if (!snapshot.exists()) {
    await setDoc(cartRef, {
      userId,
      items: [item],
      updatedAt: new Date(),
    });

    return;
  }

  const data = snapshot.data();

  const items: CartItem[] = Array.isArray(data.items)
    ? data.items
    : [];

  const existingIndex = items.findIndex(
    (cartItem) =>
      cartItem.productId === item.productId &&
      cartItem.pricingType === item.pricingType
  );

  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      quantity:
        items[existingIndex].quantity + item.quantity,
    };
  } else {
    items.push(item);
  }

  await updateDoc(cartRef, {
    items,
    updatedAt: new Date(),
  });
}


/* =========================================
   UPDATE CART ITEM
========================================= */

export async function updateCartItem(
  userId: string,
  productId: string,
  pricingType: "retail" | "wholesale",
  quantity: number
) {
  const cartRef = doc(db, "carts", userId);

  const snapshot = await getDoc(cartRef);

  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data();

  const items: CartItem[] = Array.isArray(data.items)
    ? data.items
    : [];

  const updatedItems = items
    .map((item) => {
      if (
        item.productId === productId &&
        item.pricingType === pricingType
      ) {
        return {
          ...item,
          quantity,
        };
      }

      return item;
    })
    .filter((item) => item.quantity > 0);

  await updateDoc(cartRef, {
    items: updatedItems,
    updatedAt: new Date(),
  });
}


/* =========================================
   REMOVE CART ITEM
========================================= */

export async function removeFromCart(
  userId: string,
  productId: string,
  pricingType: "retail" | "wholesale"
) {
  const cartRef = doc(db, "carts", userId);

  const snapshot = await getDoc(cartRef);

  if (!snapshot.exists()) {
    return;
  }

  const data = snapshot.data();

  const items: CartItem[] = Array.isArray(data.items)
    ? data.items
    : [];

  const updatedItems = items.filter(
    (item) =>
      !(
        item.productId === productId &&
        item.pricingType === pricingType
      )
  );

  await updateDoc(cartRef, {
    items: updatedItems,
    updatedAt: new Date(),
  });
}


/* =========================================
   CLEAR CART
========================================= */

export async function clearCart(userId: string) {
  const cartRef = doc(db, "carts", userId);

  await updateDoc(cartRef, {
    items: [],
    updatedAt: new Date(),
  });
}
