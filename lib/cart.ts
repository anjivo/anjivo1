import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  SetCompositionItem,
  WholesaleTier,
  WholesaleUnit,
} from "@/types/product";

/* =========================================================
   TYPES
========================================================= */

export type CartPricingType =
  | "retail"
  | "wholesale";

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

  /*
   * Quantity meaning:
   *
   * Retail + wholesale PIECE:
   * quantity = number of pieces
   *
   * Wholesale SET:
   * quantity = number of sets
   */
  quantity: number;

  moq: number;

  selectedPrice: number;

  pricingType: CartPricingType;

  stock: number;

  /* =======================================================
     SET / PACK INFORMATION
  ======================================================= */

  sellingMode?: "PIECE" | "SET" | "BOTH";

  wholesaleUnit?: WholesaleUnit;

  /*
   * Number of pieces contained in one set.
   *
   * Example:
   * 1 set = 6 pieces
   */
  piecesPerSet?: number;

  setName?: string;

  setBreakAllowed?: boolean;

  setComposition?: SetCompositionItem[];

  /*
   * Explicitly stores whether this cart line is a set.
   * This makes old and new cart records easier to handle.
   */
  isSet?: boolean;
};

/* =========================================================
   CART
========================================================= */

export type Cart = {
  userId: string;

  items: CartItem[];

  updatedAt?: unknown;

  subtotal: number;
};

/* =========================================================
   WHOLESALE PRICE CALCULATOR
========================================================= */

/**
 * Returns the wholesale price according to quantity.
 *
 * For PIECE wholesale:
 * quantity = pieces
 *
 * For SET wholesale:
 * quantity = sets
 *
 * Therefore the tiers always operate on the product's
 * configured wholesale unit.
 */
export function getWholesalePrice(
  item: {
    wholesalePrice: number;
    wholesaleTiers?: WholesaleTier[];
  },
  quantity: number
): number {
  const tiers = Array.isArray(item.wholesaleTiers)
    ? [...item.wholesaleTiers]
        .filter(
          (tier) =>
            Number(tier.minQuantity) > 0 &&
            Number(tier.price) > 0
        )
        .sort(
          (a, b) =>
            Number(b.minQuantity) -
            Number(a.minQuantity)
        )
    : [];

  for (const tier of tiers) {
    const min = Number(tier.minQuantity);

    const max =
      tier.maxQuantity === undefined ||
      tier.maxQuantity === null
        ? undefined
        : Number(tier.maxQuantity);

    if (
      quantity >= min &&
      (max === undefined || quantity <= max)
    ) {
      return Number(tier.price);
    }
  }

  return Number(item.wholesalePrice || 0);
}

/* =========================================================
   SELECTED PRICE
========================================================= */

export function getSelectedPrice(
  item: CartItem
): number {
  if (item.pricingType === "wholesale") {
    return getWholesalePrice(
      item,
      item.quantity
    );
  }

  return Number(item.retailPrice || 0);
}

/* =========================================================
   PIECES IN CART
========================================================= */

/**
 * Returns actual piece quantity represented by a cart item.
 *
 * Retail / wholesale piece:
 *   quantity = pieces
 *
 * Wholesale set:
 *   quantity × piecesPerSet
 */
export function getCartItemPieceQuantity(
  item: CartItem
): number {
  if (
    item.pricingType === "wholesale" &&
    item.isSet &&
    Number(item.piecesPerSet) > 0
  ) {
    return (
      item.quantity *
      Number(item.piecesPerSet)
    );
  }

  return item.quantity;
}

/* =========================================================
   CART ITEM TOTAL
========================================================= */

export function getCartItemTotal(
  item: CartItem
): number {
  return (
    getSelectedPrice(item) *
    item.quantity
  );
}

/* =========================================================
   CART SUBTOTAL
========================================================= */

export function getCartSubtotal(
  cart: Cart
): number {
  return cart.items.reduce(
    (total, item) =>
      total + getCartItemTotal(item),
    0
  );
}

/* =========================================================
   SELLER SUBTOTAL
========================================================= */

export function getSellerSubtotal(
  items: CartItem[]
): number {
  return items.reduce(
    (total, item) =>
      total + getCartItemTotal(item),
    0
  );
}

/* =========================================================
   GROUP CART BY SELLER
========================================================= */

export function groupCartBySeller(
  cart: Cart
): Record<string, CartItem[]> {
  const groups: Record<
    string,
    CartItem[]
  > = {};

  for (const item of cart.items) {
    const sellerId =
      item.sellerId || "unknown-seller";

    if (!groups[sellerId]) {
      groups[sellerId] = [];
    }

    groups[sellerId].push(item);
  }

  return groups;
}

/* =========================================================
   CART ITEM KEY
========================================================= */

/**
 * Different configurations of the same product must remain
 * separate in the cart.
 *
 * Examples:
 *
 * Product A + Retail
 * Product A + Wholesale Piece
 * Product A + Wholesale Set
 *
 * These must not merge together.
 */
export function getCartItemKey(
  item: Pick<
    CartItem,
    | "id"
    | "sellerId"
    | "pricingType"
    | "wholesaleUnit"
    | "piecesPerSet"
    | "setName"
  >
): string {
  return [
    item.id,
    item.sellerId,
    item.pricingType,
    item.wholesaleUnit || "NONE",
    item.piecesPerSet || 0,
    item.setName || "",
  ].join("::");
}

/* =========================================================
   NORMALIZE CART ITEM
========================================================= */

function normalizeCartItem(
  item: any
): CartItem {
  const wholesaleTiers =
    Array.isArray(item.wholesaleTiers)
      ? item.wholesaleTiers
          .map((tier: any) => ({
            minQuantity: Number(
              tier?.minQuantity ?? 0
            ),

            maxQuantity:
              tier?.maxQuantity === undefined ||
              tier?.maxQuantity === null
                ? undefined
                : Number(
                    tier.maxQuantity
                  ),

            price: Number(
              tier?.price ?? 0
            ),
          }))
          .filter(
            (tier: WholesaleTier) =>
              tier.minQuantity > 0 &&
              tier.price > 0
          )
      : [];

  const isSet =
    Boolean(item.isSet) ||
    (
      item.pricingType === "wholesale" &&
      item.wholesaleUnit === "SET"
    );

  const piecesPerSet =
    Number(item.piecesPerSet) > 0
      ? Number(item.piecesPerSet)
      : undefined;

  const cartItem: CartItem = {
    id: item.id || "",

    sellerId:
      item.sellerId || "",

    sellerName:
      item.sellerName || "",

    name:
      item.name || "Product",

    slug:
      item.slug || "",

    image:
      item.image || "",

    mrp:
      Number(item.mrp || 0),

    retailPrice:
      Number(item.retailPrice || 0),

    wholesalePrice:
      Number(item.wholesalePrice || 0),

    wholesaleTiers,

    quantity:
      Math.max(
        1,
        Number(item.quantity || 1)
      ),

    moq:
      Math.max(
        1,
        Number(item.moq || 1)
      ),

    selectedPrice: 0,

    pricingType:
      item.pricingType ===
      "wholesale"
        ? "wholesale"
        : "retail",

    stock:
      Math.max(
        0,
        Number(item.stock || 0)
      ),

    sellingMode:
      item.sellingMode === "SET" ||
      item.sellingMode === "BOTH"
        ? item.sellingMode
        : item.sellingMode === "PIECE"
        ? "PIECE"
        : undefined,

    wholesaleUnit:
      item.wholesaleUnit === "SET"
        ? "SET"
        : item.wholesaleUnit === "PIECE"
        ? "PIECE"
        : undefined,

    piecesPerSet,

    setName:
      item.setName || undefined,

    setBreakAllowed:
      typeof item.setBreakAllowed ===
      "boolean"
        ? item.setBreakAllowed
        : undefined,

    setComposition:
      Array.isArray(item.setComposition)
        ? item.setComposition
        : undefined,

    isSet,
  };

  cartItem.selectedPrice =
    getSelectedPrice(cartItem);

  return cartItem;
}

/* =========================================================
   GET CART
========================================================= */

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
          (item: any) =>
            normalizeCartItem(item)
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
    getCartSubtotal(cart);

  return cart;
}

/* =========================================================
   SAVE CART
========================================================= */

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
      const normalized =
        normalizeCartItem(item);

      /*
       * Keep quantity valid.
       */
      normalized.quantity =
        Math.max(
          1,
          Math.floor(
            Number(
              normalized.quantity || 1
            )
          )
        );

      /*
       * Wholesale MOQ.
       */
      if (
        normalized.pricingType ===
          "wholesale" &&
        normalized.quantity <
          normalized.moq
      ) {
        normalized.quantity =
          normalized.moq;
      }

      /*
       * Stock:
       *
       * For SET products stock is still
       * represented as available SETS.
       *
       * The secure checkout API will perform
       * the final server-side component stock
       * validation.
       */
      if (
        normalized.stock > 0 &&
        normalized.quantity >
          normalized.stock
      ) {
        normalized.quantity =
          normalized.stock;
      }

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

/* =========================================================
   ADD TO CART
========================================================= */

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

  const incomingKey =
    getCartItemKey(item);

  const existingIndex =
    cart.items.findIndex(
      (cartItem) =>
        getCartItemKey(
          cartItem
        ) === incomingKey
    );

  if (existingIndex >= 0) {
    const existing =
      cart.items[
        existingIndex
      ];

    existing.quantity +=
      Math.max(
        1,
        Math.floor(
          Number(quantity || 1)
        )
      );

    /*
     * Wholesale MOQ.
     */
    if (
      existing.pricingType ===
        "wholesale" &&
      existing.quantity <
        existing.moq
    ) {
      existing.quantity =
        existing.moq;
    }

    /*
     * Stock.
     */
    if (
      existing.stock > 0 &&
      existing.quantity >
        existing.stock
    ) {
      existing.quantity =
        existing.stock;
    }

    existing.selectedPrice =
      getSelectedPrice(
        existing
      );
  } else {
    const newItem =
      normalizeCartItem({
        ...item,

        quantity:
          Math.max(
            1,
            Math.floor(
              Number(
                quantity || 1
              )
            )
          ),
      });

    /*
     * Wholesale MOQ.
     */
    if (
      newItem.pricingType ===
        "wholesale" &&
      newItem.quantity <
        newItem.moq
    ) {
      newItem.quantity =
        newItem.moq;
    }

    /*
     * Stock.
     */
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

  return getCart(userId);
}

/* =========================================================
   UPDATE CART QUANTITY
========================================================= */

export async function updateCartQuantity(
  userId: string,
  productId: string,
  sellerId: string,
  pricingType:
    | "retail"
    | "wholesale",
  quantity: number,
  options?: {
    wholesaleUnit?: WholesaleUnit;
    piecesPerSet?: number;
    setName?: string;
  }
): Promise<Cart> {
  const cart =
    await getCart(userId);

  const index =
    cart.items.findIndex(
      (item) => {
        if (
          item.id !== productId ||
          item.sellerId !== sellerId ||
          item.pricingType !==
            pricingType
        ) {
          return false;
        }

        if (
          options?.wholesaleUnit &&
          item.wholesaleUnit !==
            options.wholesaleUnit
        ) {
          return false;
        }

        if (
          options?.piecesPerSet &&
          item.piecesPerSet !==
            options.piecesPerSet
        ) {
          return false;
        }

        if (
          options?.setName !== undefined &&
          item.setName !==
            options.setName
        ) {
          return false;
        }

        return true;
      }
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
        Number(quantity)
      )
    );

  /*
   * Wholesale MOQ.
   */
  if (
    pricingType ===
      "wholesale" &&
    nextQuantity <
      item.moq
  ) {
    nextQuantity =
      item.moq;
  }

  /*
   * Stock.
   */
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

  return getCart(userId);
}

/* =========================================================
   REMOVE FROM CART
========================================================= */

export async function removeFromCart(
  userId: string,
  productId: string,
  sellerId: string,
  pricingType:
    | "retail"
    | "wholesale",
  options?: {
    wholesaleUnit?: WholesaleUnit;
    piecesPerSet?: number;
    setName?: string;
  }
): Promise<Cart> {
  const cart =
    await getCart(userId);

  cart.items =
    cart.items.filter(
      (item) => {
        if (
          item.id !== productId ||
          item.sellerId !== sellerId ||
          item.pricingType !==
            pricingType
        ) {
          return true;
        }

        if (
          options?.wholesaleUnit &&
          item.wholesaleUnit !==
            options.wholesaleUnit
        ) {
          return true;
        }

        if (
          options?.piecesPerSet &&
          item.piecesPerSet !==
            options.piecesPerSet
        ) {
          return true;
        }

        if (
          options?.setName !== undefined &&
          item.setName !==
            options.setName
        ) {
          return true;
        }

        return false;
      }
    );

  await saveCart(
    userId,
    cart.items
  );

  return getCart(userId);
}

/* =========================================================
   CLEAR CART
========================================================= */

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
