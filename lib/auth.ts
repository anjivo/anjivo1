import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

export type CartItem = {
  productId: string;
  name: string;
  slug: string;

  sellerId: string;
  sellerName?: string;

  image?: string;

  mrp: number;
  retailPrice: number;
  wholesalePrice: number;

  wholesaleTiers: WholesaleTier[];

  quantity: number;
  moq: number;

  selectedPrice: number;
  pricingType:
    | "retail"
    | "wholesale";

  stock: number;
};

export type Cart = {
  userId: string;
  items: CartItem[];
  updatedAt?: unknown;
};

/* =========================================================
   PRICE CALCULATION
========================================================= */

export function getWholesalePrice(
  item: CartItem,
  quantity: number
): number {
  if (
    !item.wholesaleTiers ||
    item.wholesaleTiers.length === 0
  ) {
    return item.wholesalePrice;
  }

  const sortedTiers =
    [...item.wholesaleTiers].sort(
      (a, b) =>
        b.minQuantity -
        a.minQuantity
    );

  const matchingTier =
    sortedTiers.find(
      (tier) =>
        quantity >=
        tier.minQuantity &&
        (
          tier.maxQuantity ===
            undefined ||
          quantity <=
            tier.maxQuantity
        )
    );

  return matchingTier
    ? matchingTier.price
    : item.wholesalePrice;
}

/* =========================================================
   SELECT PRICE
========================================================= */

export function getSelectedPrice(
  item: CartItem,
  quantity: number
): number {
  if (
    item.pricingType ===
    "wholesale"
  ) {
    return getWholesalePrice(
      item,
      quantity
    );
  }

  return item.retailPrice;
}

/* =========================================================
   GET CART
========================================================= */

export async function getCart(
  userId: string
): Promise<Cart> {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const cartRef = doc(
    db,
    "carts",
    userId
  );

  const snapshot =
    await getDoc(cartRef);

  if (!snapshot.exists()) {
    return {
      userId,
      items: [],
    };
  }

  const data =
    snapshot.data();

  const rawItems =
    Array.isArray(data.items)
      ? data.items
      : [];

  const items: CartItem[] =
    rawItems.map(
      (item) => {
        const value =
          item as Record<
            string,
            unknown
          >;

        const quantity =
          Math.max(
            1,
            Number(
              value.quantity ?? 1
            )
          );

        const wholesaleTiers =
          Array.isArray(
            value.wholesaleTiers
          )
            ? value.wholesaleTiers.map(
                (tier) => {
                  const t =
                    tier as Record<
                      string,
                      unknown
                    >;

                  return {
                    minQuantity:
                      Number(
                        t.minQuantity ??
                          0
                      ),

                    maxQuantity:
                      t.maxQuantity !==
                      undefined
                        ? Number(
                            t.maxQuantity
                          )
                        : undefined,

                    price: Number(
                      t.price ?? 0
                    ),
                  };
                }
              )
            : [];

        const cartItem: CartItem =
          {
            productId: String(
              value.productId ??
                ""
            ),

            name: String(
              value.name ?? ""
            ),

            slug: String(
              value.slug ?? ""
            ),

            sellerId: String(
              value.sellerId ??
                ""
            ),

            sellerName:
              typeof value.sellerName ===
              "string"
                ? value.sellerName
                : undefined,

            image:
              typeof value.image ===
              "string"
                ? value.image
                : undefined,

            mrp: Number(
              value.mrp ?? 0
            ),

            retailPrice: Number(
              value.retailPrice ?? 0
            ),

            wholesalePrice:
              Number(
                value.wholesalePrice ??
                  0
              ),

            wholesaleTiers,

            quantity,

            moq: Math.max(
              1,
              Number(
                value.moq ?? 1
              )
            ),

            selectedPrice:
              Number(
                value.selectedPrice ??
                  value.retailPrice ??
                  0
              ),

            pricingType:
              value.pricingType ===
              "wholesale"
                ? "wholesale"
                : "retail",

            stock: Math.max(
              0,
              Number(
                value.stock ?? 0
              )
            ),
          };

        return {
          ...cartItem,
          selectedPrice:
            getSelectedPrice(
              cartItem,
              quantity
            ),
        };
      }
    );

  return {
    userId,
    items,
    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   SAVE CART
========================================================= */

async function saveCart(
  userId: string,
  items: CartItem[]
) {
  const cartRef = doc(
    db,
    "carts",
    userId
  );

  await setDoc(
    cartRef,
    {
      userId,
      items,
      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* =========================================================
   ADD TO CART
========================================================= */

export async function addToCart(
  userId: string,
  item: CartItem
): Promise<Cart> {
  if (!userId) {
    throw new Error(
      "Please login to add products to cart."
    );
  }

  if (!item.productId) {
    throw new Error(
      "Product ID is required."
    );
  }

  if (!item.sellerId) {
    throw new Error(
      "Seller information is missing."
    );
  }

  const cart =
    await getCart(userId);

  const existingIndex =
    cart.items.findIndex(
      (cartItem) =>
        cartItem.productId ===
          item.productId &&
        cartItem.sellerId ===
          item.sellerId &&
        cartItem.pricingType ===
          item.pricingType
    );

  let items = [
    ...cart.items,
  ];

  if (existingIndex >= 0) {
    const existing =
      items[existingIndex];

    const newQuantity =
      existing.quantity +
      Math.max(
        1,
        item.quantity
      );

    if (
      existing.stock > 0 &&
      newQuantity >
        existing.stock
    ) {
      throw new Error(
        `Only ${existing.stock} units are available.`
      );
    }

    items[existingIndex] = {
      ...existing,
      quantity:
        newQuantity,
      selectedPrice:
        getSelectedPrice(
          existing,
          newQuantity
        ),
    };
  } else {
    const quantity =
      Math.max(
        1,
        item.quantity
      );

    if (
      item.stock > 0 &&
      quantity >
        item.stock
    ) {
      throw new Error(
        `Only ${item.stock} units are available.`
      );
    }

    items.push({
      ...item,
      quantity,
      selectedPrice:
        getSelectedPrice(
          item,
          quantity
        ),
    });
  }

  await saveCart(
    userId,
    items
  );

  return {
    userId,
    items,
  };
}

/* =========================================================
   UPDATE QUANTITY
========================================================= */

export async function updateCartQuantity(
  userId: string,
  productId: string,
  sellerId: string,
  quantity: number
): Promise<Cart> {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const cart =
    await getCart(userId);

  const items =
    cart.items.map(
      (item) => {
        if (
          item.productId !==
            productId ||
          item.sellerId !==
            sellerId
        ) {
          return item;
        }

        const newQuantity =
          Math.max(
            1,
            Math.floor(quantity)
          );

        if (
          item.stock > 0 &&
          newQuantity >
            item.stock
        ) {
          throw new Error(
            `Only ${item.stock} units are available.`
          );
        }

        return {
          ...item,
          quantity:
            newQuantity,
          selectedPrice:
            getSelectedPrice(
              item,
              newQuantity
            ),
        };
      }
    );

  await saveCart(
    userId,
    items
  );

  return {
    userId,
    items,
  };
}

/* =========================================================
   REMOVE ITEM
========================================================= */

export async function removeFromCart(
  userId: string,
  productId: string,
  sellerId: string
): Promise<Cart> {
  const cart =
    await getCart(userId);

  const items =
    cart.items.filter(
      (item) =>
        !(
          item.productId ===
            productId &&
          item.sellerId ===
            sellerId
        )
    );

  await saveCart(
    userId,
    items
  );

  return {
    userId,
    items,
  };
}

/* =========================================================
   CLEAR CART
========================================================= */

export async function clearCart(
  userId: string
): Promise<void> {
  const cartRef = doc(
    db,
    "carts",
    userId
  );

  await updateDoc(
    cartRef,
    {
      items: [],
      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   GROUP BY SELLER
========================================================= */

export function groupCartBySeller(
  items: CartItem[]
) {
  const groups =
    new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        items: CartItem[];
      }
    >();

  items.forEach(
    (item) => {
      if (!groups.has(item.sellerId)) {
        groups.set(
          item.sellerId,
          {
            sellerId:
              item.sellerId,

            sellerName:
              item.sellerName ||
              "Seller",

            items: [],
          }
        );
      }

      groups
        .get(item.sellerId)!
        .items.push(item);
    }
  );

  return Array.from(
    groups.values()
  );
}

/* =========================================================
   CART TOTAL
========================================================= */

export function getCartSubtotal(
  items: CartItem[]
): number {
  return items.reduce(
    (sum, item) =>
      sum +
      item.selectedPrice *
        item.quantity,
    0
  );
}

/* =========================================================
   SELLER SUBTOTAL
========================================================= */

export function getSellerSubtotal(
  items: CartItem[]
): number {
  return getCartSubtotal(
    items
  );
}
