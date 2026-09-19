import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

export type CartItem = {
  id: string;

  sellerId: string;
  sellerName?: string;

  name: string;
  slug: string;

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

  subtotal: number;
};

/* ----------------------------------------
   Wholesale Price Calculator
---------------------------------------- */

export function getWholesalePrice(
  item: {
    wholesalePrice: number;
    wholesaleTiers?: WholesaleTier[];
  },
  quantity: number
): number {
  const tiers =
    Array.isArray(
      item.wholesaleTiers
    )
      ? [...item.wholesaleTiers]
          .filter(
            (tier) =>
              Number(
                tier.minQuantity
              ) > 0 &&
              Number(
                tier.price
              ) > 0
          )
          .sort(
            (a, b) =>
              b.minQuantity -
              a.minQuantity
          )
      : [];

  for (const tier of tiers) {
    const min =
      Number(
        tier.minQuantity
      );

    const max =
      tier.maxQuantity ===
        undefined ||
      tier.maxQuantity ===
        null
        ? undefined
        : Number(
            tier.maxQuantity
          );

    if (
      quantity >= min &&
      (max === undefined ||
        quantity <= max)
    ) {
      return Number(
        tier.price
      );
    }
  }

  return Number(
    item.wholesalePrice || 0
  );
}

/* ----------------------------------------
   Selected Price
---------------------------------------- */

export function getSelectedPrice(
  item: CartItem
): number {
  if (
    item.pricingType ===
    "wholesale"
  ) {
    return getWholesalePrice(
      item,
      item.quantity
    );
  }

  return Number(
    item.retailPrice || 0
  );
}

/* ----------------------------------------
   Calculate Subtotal
---------------------------------------- */

export function getCartSubtotal(
  cart: Cart
): number {
  return cart.items.reduce(
    (total, item) => {
      const price =
        getSelectedPrice(
          item
        );

      return (
        total +
        price *
          item.quantity
      );
    },
    0
  );
}

/* ----------------------------------------
   Get Seller Subtotal
---------------------------------------- */

export function getSellerSubtotal(
  items: CartItem[]
): number {
  return items.reduce(
    (total, item) => {
      const price =
        getSelectedPrice(
          item
        );

      return (
        total +
        price *
          item.quantity
      );
    },
    0
  );
}

/* ----------------------------------------
   GROUP CART BY SELLER
---------------------------------------- */

export function groupCartBySeller(
  cart: Cart
): Record<string, CartItem[]> {
  const groups: Record<
    string,
    CartItem[]
  > = {};

  for (const item of cart.items) {
    const sellerId =
      item.sellerId ||
      "unknown-seller";

    if (!groups[sellerId]) {
      groups[sellerId] = [];
    }

    groups[sellerId].push(
      item
    );
  }

  return groups;
}

/* ----------------------------------------
   Get Cart
---------------------------------------- */

export async function getCart(
  userId: string
): Promise<Cart> {
  if (!userId) {
    return {
      userId: "",
      items: [],
      subtotal: 0,
    };
  }

  const cartRef = doc(
    db,
    "carts",
    userId
  );

  const cartSnap =
    await getDoc(cartRef);

  if (!cartSnap.exists()) {
    return {
      userId,
      items: [],
      subtotal: 0,
    };
  }

  const data =
    cartSnap.data();

  const items: CartItem[] =
    Array.isArray(data.items)
      ? data.items.map(
          (item: any) => {
            const wholesaleTiers =
              Array.isArray(
                item.wholesaleTiers
              )
                ? item.wholesaleTiers.map(
                    (tier: any) => ({
                      minQuantity:
                        Number(
                          tier.minQuantity ??
                            0
                        ),

                      maxQuantity:
                        tier.maxQuantity ===
                          undefined ||
                        tier.maxQuantity ===
                          null
                          ? undefined
                          : Number(
                              tier.maxQuantity
                            ),

                      price:
                        Number(
                          tier.price ??
                            0
                        ),
                    })
                  )
                : [];

            const cartItem: CartItem =
              {
                id:
                  item.id || "",

                sellerId:
                  item.sellerId || "",

                sellerName:
                  item.sellerName ||
                  "",

                name:
                  item.name ||
                  "Product",

                slug:
                  item.slug || "",

                image:
                  item.image || "",

                mrp:
                  Number(
                    item.mrp || 0
                  ),

                retailPrice:
                  Number(
                    item.retailPrice ||
                      0
                  ),

                wholesalePrice:
                  Number(
                    item.wholesalePrice ||
                      0
                  ),

                wholesaleTiers,

                quantity:
                  Math.max(
                    1,
                    Number(
                      item.quantity ||
                        1
                    )
                  ),

                moq:
                  Math.max(
                    1,
                    Number(
                      item.moq || 1
                    )
                  ),

                selectedPrice:
                  Number(
                    item.selectedPrice ||
                      0
                  ),

                pricingType:
                  item.pricingType ===
                  "wholesale"
                    ? "wholesale"
                    : "retail",

                stock:
                  Number(
                    item.stock || 0
                  ),
              };

            cartItem.selectedPrice =
              getSelectedPrice(
                cartItem
              );

            return cartItem;
          }
        )
      : [];

  const cart: Cart = {
    userId,

    items,

    subtotal: 0,

    updatedAt:
      data.updatedAt,
  };

  cart.subtotal =
    getCartSubtotal(
      cart
    );

  return cart;
}

/* ----------------------------------------
   Save Cart
---------------------------------------- */

export async function saveCart(
  userId: string,
  items: CartItem[]
): Promise<void> {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const normalizedItems =
    items.map((item) => {
      const normalized: CartItem =
        {
          ...item,

          quantity:
            Math.max(
              1,
              Number(
                item.quantity || 1
              )
            ),

          moq:
            Math.max(
              1,
              Number(
                item.moq || 1
              )
            ),

          stock:
            Math.max(
              0,
              Number(
                item.stock || 0
              )
            ),
        };

      normalized.selectedPrice =
        getSelectedPrice(
          normalized
        );

      return normalized;
    });

  const subtotal =
    normalizedItems.reduce(
      (total, item) =>
        total +
        item.selectedPrice *
          item.quantity,
      0
    );

  await setDoc(
    doc(
      db,
      "carts",
      userId
    ),
    {
      userId,

      items:
        normalizedItems,

      subtotal,

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* ----------------------------------------
   Add To Cart
---------------------------------------- */

export async function addToCart(
  userId: string,
  item: Omit<
    CartItem,
    "quantity" | "selectedPrice"
  >,
  quantity: number = 1
): Promise<Cart> {
  if (!userId) {
    throw new Error(
      "Please login first."
    );
  }

  if (
    !item.id ||
    !item.sellerId
  ) {
    throw new Error(
      "Invalid product."
    );
  }

  const cart =
    await getCart(userId);

  const pricingType =
    item.pricingType;

  const existingIndex =
    cart.items.findIndex(
      (cartItem) =>
        cartItem.id ===
          item.id &&
        cartItem.sellerId ===
          item.sellerId &&
        cartItem.pricingType ===
          pricingType
    );

  if (
    existingIndex >= 0
  ) {
    const existing =
      cart.items[
        existingIndex
      ];

    existing.quantity +=
      quantity;

    if (
      existing.stock > 0 &&
      existing.quantity >
        existing.stock
    ) {
      existing.quantity =
        existing.stock;
    }

    if (
      existing.pricingType ===
        "wholesale" &&
      existing.quantity <
        existing.moq
    ) {
      existing.quantity =
        existing.moq;
    }

    existing.selectedPrice =
      getSelectedPrice(
        existing
      );
  } else {
    const newItem: CartItem =
      {
        ...item,

        quantity:
          Math.max(
            1,
            quantity
          ),

        selectedPrice: 0,
      };

    if (
      newItem.pricingType ===
        "wholesale" &&
      newItem.quantity <
        newItem.moq
    ) {
      newItem.quantity =
        newItem.moq;
    }

    if (
      newItem.stock > 0 &&
      newItem.quantity >
        newItem.stock
    ) {
      newItem.quantity =
        newItem.stock;
    }

    newItem.selectedPrice =
      getSelectedPrice(
        newItem
      );

    cart.items.push(
      newItem
    );
  }

  await saveCart(
    userId,
    cart.items
  );

  return getCart(
    userId
  );
}

/* ----------------------------------------
   Update Cart Quantity
---------------------------------------- */

export async function updateCartQuantity(
  userId: string,
  productId: string,
  sellerId: string,
  pricingType:
    | "retail"
    | "wholesale",
  quantity: number
): Promise<Cart> {
  const cart =
    await getCart(userId);

  const index =
    cart.items.findIndex(
      (item) =>
        item.id ===
          productId &&
        item.sellerId ===
          sellerId &&
        item.pricingType ===
          pricingType
    );

  if (index === -1) {
    return cart;
  }

  const item =
    cart.items[index];

  let nextQuantity =
    Math.max(
      1,
      Math.floor(
        quantity
      )
    );

  if (
    pricingType ===
      "wholesale" &&
    nextQuantity <
      item.moq
  ) {
    nextQuantity =
      item.moq;
  }

  if (
    item.stock > 0 &&
    nextQuantity >
      item.stock
  ) {
    nextQuantity =
      item.stock;
  }

  item.quantity =
    nextQuantity;

  item.selectedPrice =
    getSelectedPrice(
      item
    );

  await saveCart(
    userId,
    cart.items
  );

  return getCart(
    userId
  );
}

/* ----------------------------------------
   Remove From Cart
---------------------------------------- */

export async function removeFromCart(
  userId: string,
  productId: string,
  sellerId: string,
  pricingType:
    | "retail"
    | "wholesale"
): Promise<Cart> {
  const cart =
    await getCart(userId);

  cart.items =
    cart.items.filter(
      (item) =>
        !(
          item.id ===
            productId &&
          item.sellerId ===
            sellerId &&
          item.pricingType ===
            pricingType
        )
    );

  await saveCart(
    userId,
    cart.items
  );

  return getCart(
    userId
  );
}

/* ----------------------------------------
   Clear Cart
---------------------------------------- */

export async function clearCart(
  userId: string
): Promise<void> {
  if (!userId) {
    return;
  }

  await setDoc(
    doc(
      db,
      "carts",
      userId
    ),
    {
      userId,

      items: [],

      subtotal: 0,

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}
