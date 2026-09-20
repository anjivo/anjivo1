import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  CartItem,
  getWholesalePrice,
} from "@/lib/cart";

export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "SELLER_MISMATCH"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "INVALID_QUANTITY"
  | "MOQ_NOT_MET"
  | "INVALID_WHOLESALE_PRICE"
  | "PRICE_CHANGED"
  | "INVALID_ITEM";

export type CheckoutError = {
  code: CheckoutErrorCode;
  productId?: string;
  sellerId?: string;
  message: string;
};

export type ValidatedCheckoutItem = {
  productId: string;
  sellerId: string;
  sellerName?: string;

  name: string;
  slug: string;
  image?: string;

  quantity: number;

  pricingType:
    | "retail"
    | "wholesale";

  unitPrice: number;
  subtotal: number;

  mrp: number;
  retailPrice: number;
  wholesalePrice: number;
  moq: number;

  wholesaleTiers: {
    minQuantity: number;
    maxQuantity?: number;
    price: number;
  }[];

  stock: number;
};

export type SellerCheckoutGroup = {
  sellerId: string;
  sellerName: string;
  items: ValidatedCheckoutItem[];
  subtotal: number;
  itemCount: number;
};

export type CheckoutSummary = {
  items: ValidatedCheckoutItem[];

  sellerGroups: SellerCheckoutGroup[];

  subtotal: number;

  retailSubtotal: number;

  wholesaleSubtotal: number;

  totalItems: number;

  sellerCount: number;

  errors: CheckoutError[];
};

type FirestoreProduct = {
  id: string;

  name: string;
  slug: string;

  description?: string;

  categoryId: string;
  categoryName?: string;

  subcategoryId?: string;

  sellerId: string;
  sellerName?: string;

  sellerVerified?: boolean;

  images: string[];

  mrp: number;
  retailPrice: number;
  wholesalePrice: number;

  moq: number;

  wholesaleTiers: {
    minQuantity: number;
    maxQuantity?: number;
    price: number;
  }[];

  stock: number;

  status:
    | "active"
    | "draft"
    | "out_of_stock"
    | "blocked";
};

function numberValue(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function mapProduct(
  id: string,
  data: Record<string, unknown>
): FirestoreProduct {
  const rawTiers = Array.isArray(
    data.wholesaleTiers
  )
    ? data.wholesaleTiers
    : [];

  const wholesaleTiers =
    rawTiers
      .map((raw) => {
        if (
          typeof raw !== "object" ||
          raw === null
        ) {
          return null;
        }

        const tier =
          raw as Record<
            string,
            unknown
          >;

        const minQuantity =
          numberValue(
            tier.minQuantity
          );

        const price =
          numberValue(
            tier.price
          );

        if (
          minQuantity <= 0 ||
          price <= 0
        ) {
          return null;
        }

        const maxQuantity =
          numberValue(
            tier.maxQuantity
          );

        return {
          minQuantity,
          ...(maxQuantity > 0
            ? {
                maxQuantity,
              }
            : {}),
          price,
        };
      })
      .filter(
        (
          tier
        ): tier is {
          minQuantity: number;
          maxQuantity?: number;
          price: number;
        } => tier !== null
      )
      .sort(
        (a, b) =>
          a.minQuantity -
          b.minQuantity
      );

  return {
    id,

    name:
      stringValue(data.name),

    slug:
      stringValue(data.slug),

    description:
      stringValue(
        data.description
      ),

    categoryId:
      stringValue(
        data.categoryId
      ),

    categoryName:
      stringValue(
        data.categoryName
      ),

    subcategoryId:
      stringValue(
        data.subcategoryId
      ),

    sellerId:
      stringValue(
        data.sellerId
      ),

    sellerName:
      stringValue(
        data.sellerName
      ),

    sellerVerified:
      data.sellerVerified ===
      true,

    images:
      Array.isArray(
        data.images
      )
        ? data.images.filter(
            (
              value
            ): value is string =>
              typeof value ===
              "string"
          )
        : [],

    mrp:
      numberValue(
        data.mrp
      ),

    retailPrice:
      numberValue(
        data.retailPrice
      ),

    wholesalePrice:
      numberValue(
        data.wholesalePrice
      ),

    moq:
      Math.max(
        1,
        numberValue(
          data.moq
        )
      ),

    wholesaleTiers,

    stock:
      Math.max(
        0,
        numberValue(
          data.stock
        )
      ),

    status:
      data.status ===
        "active" ||
      data.status ===
        "draft" ||
      data.status ===
        "out_of_stock" ||
      data.status ===
        "blocked"
        ? data.status
        : "draft",
  };
}

/**
 * Gets products from Firestore by their IDs.
 *
 * Important:
 * We intentionally read the current Firestore product
 * instead of trusting product information stored inside
 * the browser cart.
 */
export async function getCheckoutProducts(
  productIds: string[]
): Promise<
  Map<string, FirestoreProduct>
> {
  const uniqueIds =
    Array.from(
      new Set(
        productIds.filter(
          Boolean
        )
      )
    );

  const result =
    new Map<
      string,
      FirestoreProduct
    >();

  await Promise.all(
    uniqueIds.map(
      async (productId) => {
        try {
          const snapshot =
            await getDoc(
              doc(
                db,
                "products",
                productId
              )
            );

          if (
            snapshot.exists()
          ) {
            result.set(
              productId,
              mapProduct(
                snapshot.id,
                snapshot.data()
              )
            );
          }
        } catch (error) {
          console.error(
            `Failed to load checkout product ${productId}:`,
            error
          );
        }
      }
    )
  );

  return result;
}

/**
 * Finds the price that Firestore currently considers
 * valid for a particular product + quantity.
 */
export function getCurrentCheckoutPrice(
  product: FirestoreProduct,
  pricingType:
    | "retail"
    | "wholesale",
  quantity: number
): number {
  if (
    pricingType ===
    "retail"
  ) {
    return product.retailPrice;
  }

  return getWholesalePrice(
    {
      wholesalePrice:
        product.wholesalePrice,

      wholesaleTiers:
        product.wholesaleTiers,
    },
    quantity
  );
}

function validateQuantity(
  quantity: number
): boolean {
  return (
    Number.isInteger(
      quantity
    ) &&
    quantity > 0
  );
}

function validateWholesaleConfiguration(
  product: FirestoreProduct
): boolean {
  if (
    product.wholesalePrice <= 0
  ) {
    return false;
  }

  if (
    product.moq <= 0
  ) {
    return false;
  }

  if (
    product.wholesaleTiers
      .length === 0
  ) {
    return true;
  }

  return product.wholesaleTiers.every(
    (tier) =>
      tier.minQuantity > 0 &&
      tier.price > 0
  );
}

/**
 * Validates one cart item against the current
 * Firestore product.
 */
export function validateCheckoutItem(
  cartItem: CartItem,
  product:
    | FirestoreProduct
    | undefined
): {
  item?:
    | ValidatedCheckoutItem;

  error?:
    | CheckoutError;
} {
  if (!product) {
    return {
      error: {
        code:
          "PRODUCT_NOT_FOUND",

        productId:
          cartItem.id,

        sellerId:
          cartItem.sellerId,

        message:
          "Product is no longer available.",
      },
    };
  }

  if (
    product.status !==
    "active"
  ) {
    return {
      error: {
        code:
          "PRODUCT_INACTIVE",

        productId:
          product.id,

        sellerId:
          product.sellerId,

        message:
          "This product is currently unavailable.",
      },
    };
  }

  if (
    !cartItem.sellerId ||
    !product.sellerId
  ) {
    return {
      error: {
        code:
          "SELLER_MISMATCH",

        productId:
          product.id,

        sellerId:
          cartItem.sellerId,

        message:
          "Seller information is missing.",
      },
    };
  }

  if (
    cartItem.sellerId !==
    product.sellerId
  ) {
    return {
      error: {
        code:
          "SELLER_MISMATCH",

        productId:
          product.id,

        sellerId:
          cartItem.sellerId,

        message:
          "Seller information does not match the current product.",
      },
    };
  }

  const quantity =
    numberValue(
      cartItem.quantity
    );

  if (
    !validateQuantity(
      quantity
    )
  ) {
    return {
      error: {
        code:
          "INVALID_QUANTITY",

        productId:
          product.id,

        sellerId:
          product.sellerId,

        message:
          "Product quantity is invalid.",
      },
    };
  }

  if (
    product.stock <= 0 ||
    product.status ===
      "out_of_stock"
  ) {
    return {
      error: {
        code:
          "OUT_OF_STOCK",

        productId:
          product.id,

        sellerId:
          product.sellerId,

        message:
          "This product is out of stock.",
      },
    };
  }

  if (
    quantity >
    product.stock
  ) {
    return {
      error: {
        code:
          "INSUFFICIENT_STOCK",

        productId:
          product.id,

        sellerId:
          product.sellerId,

        message:
          `Only ${product.stock} units are currently available.`,
      },
    };
  }

  if (
    cartItem.pricingType ===
    "wholesale"
  ) {
    if (
      quantity <
      product.moq
    ) {
      return {
        error: {
          code:
            "MOQ_NOT_MET",

          productId:
            product.id,

          sellerId:
            product.sellerId,

          message:
            `Minimum wholesale quantity is ${product.moq}.`,
        },
      };
    }

    if (
      !validateWholesaleConfiguration(
        product
      )
    ) {
      return {
        error: {
          code:
            "INVALID_WHOLESALE_PRICE",

          productId:
            product.id,

          sellerId:
            product.sellerId,

          message:
            "Wholesale pricing is not configured correctly.",
        },
      };
    }
  }

  const currentPrice =
    getCurrentCheckoutPrice(
      product,
      cartItem.pricingType,
      quantity
    );

  if (
    currentPrice <= 0
  ) {
    return {
      error: {
        code:
          "INVALID_WHOLESALE_PRICE",

        productId:
          product.id,

        sellerId:
          product.sellerId,

        message:
          "Current product price is invalid.",
      },
    };
  }

  /*
   * The price stored in local/browser cart is NOT trusted.
   * We compare it only to tell the customer that the price
   * has changed.
   */
  const browserPrice =
    numberValue(
      cartItem.selectedPrice
    );

  if (
    browserPrice > 0 &&
    Math.abs(
      browserPrice -
        currentPrice
    ) > 0.01
  ) {
    return {
      error: {
        code:
          "PRICE_CHANGED",

        productId:
          product.id,

        sellerId:
          product.sellerId,

        message:
          `${product.name} price has changed. Please review your cart.`,
      },
    };
  }

  const image =
    product.images?.[0] ||
    cartItem.image;

  return {
    item: {
      productId:
        product.id,

      sellerId:
        product.sellerId,

      sellerName:
        product.sellerName ||
        cartItem.sellerName ||
        "Seller",

      name:
        product.name,

      slug:
        product.slug,

      image,

      quantity,

      pricingType:
        cartItem.pricingType,

      unitPrice:
        currentPrice,

      subtotal:
        currentPrice *
        quantity,

      mrp:
        product.mrp,

      retailPrice:
        product.retailPrice,

      wholesalePrice:
        product.wholesalePrice,

      moq:
        product.moq,

      wholesaleTiers:
        product.wholesaleTiers,

      stock:
        product.stock,
    },
  };
}

/**
 * Validates the complete cart.
 *
 * This is intentionally designed for both:
 * - current checkout UI
 * - future trusted backend checkout
 */
export async function validateCheckoutCart(
  cartItems: CartItem[]
): Promise<CheckoutSummary> {
  if (
    !Array.isArray(
      cartItems
    ) ||
    cartItems.length === 0
  ) {
    return {
      items: [],

      sellerGroups: [],

      subtotal: 0,

      retailSubtotal: 0,

      wholesaleSubtotal: 0,

      totalItems: 0,

      sellerCount: 0,

      errors: [
        {
          code:
            "EMPTY_CART",

          message:
            "Your cart is empty.",
        },
      ],
    };
  }

  const productIds =
    cartItems.map(
      (item) => item.id
    );

  const products =
    await getCheckoutProducts(
      productIds
    );

  const validItems:
    ValidatedCheckoutItem[] =
    [];

  const errors:
    CheckoutError[] =
    [];

  for (
    const cartItem of cartItems
  ) {
    const product =
      products.get(
        cartItem.id
      );

    const result =
      validateCheckoutItem(
        cartItem,
        product
      );

    if (result.error) {
      errors.push(
        result.error
      );

      continue;
    }

    if (result.item) {
      validItems.push(
        result.item
      );
    }
  }

  const sellerMap =
    new Map<
      string,
      SellerCheckoutGroup
    >();

  for (
    const item of validItems
  ) {
    const existing =
      sellerMap.get(
        item.sellerId
      );

    if (existing) {
      existing.items.push(
        item
      );

      existing.subtotal +=
        item.subtotal;

      existing.itemCount +=
        item.quantity;
    } else {
      sellerMap.set(
        item.sellerId,
        {
          sellerId:
            item.sellerId,

          sellerName:
            item.sellerName ||
            "Seller",

          items: [item],

          subtotal:
            item.subtotal,

          itemCount:
            item.quantity,
        }
      );
    }
  }

  const sellerGroups =
    Array.from(
      sellerMap.values()
    );

  const subtotal =
    validItems.reduce(
      (sum, item) =>
        sum + item.subtotal,
      0
    );

  const retailSubtotal =
    validItems
      .filter(
        (item) =>
          item.pricingType ===
          "retail"
      )
      .reduce(
        (sum, item) =>
          sum + item.subtotal,
        0
      );

  const wholesaleSubtotal =
    validItems
      .filter(
        (item) =>
          item.pricingType ===
          "wholesale"
      )
      .reduce(
        (sum, item) =>
          sum + item.subtotal,
        0
      );

  const totalItems =
    validItems.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  return {
    items:
      validItems,

    sellerGroups,

    subtotal,

    retailSubtotal,

    wholesaleSubtotal,

    totalItems,

    sellerCount:
      sellerGroups.length,

    errors,
  };
}

/**
 * Returns only the items that are safe to continue
 * with after validation.
 */
export async function getValidatedCheckoutItems(
  cartItems: CartItem[]
): Promise<
  ValidatedCheckoutItem[]
> {
  const result =
    await validateCheckoutCart(
      cartItems
    );

  return result.items;
}

/**
 * Checks whether checkout can continue.
 */
export async function canProceedToCheckout(
  cartItems: CartItem[]
): Promise<boolean> {
  const result =
    await validateCheckoutCart(
      cartItems
    );

  return (
    result.items.length >
      0 &&
    result.errors.length ===
      0
  );
}

/**
 * Utility for displaying a clean message to the customer.
 */
export function getCheckoutErrorMessage(
  error: CheckoutError
): string {
  switch (error.code) {
    case "EMPTY_CART":
      return "Your cart is empty.";

    case "PRODUCT_NOT_FOUND":
      return "One of the products is no longer available.";

    case "PRODUCT_INACTIVE":
      return "One of the products is currently unavailable.";

    case "SELLER_MISMATCH":
      return "Seller information changed. Please refresh your cart.";

    case "OUT_OF_STOCK":
      return "One of your products is out of stock.";

    case "INSUFFICIENT_STOCK":
      return error.message;

    case "INVALID_QUANTITY":
      return "One of the product quantities is invalid.";

    case "MOQ_NOT_MET":
      return error.message;

    case "INVALID_WHOLESALE_PRICE":
      return "Wholesale pricing is currently unavailable for one of the products.";

    case "PRICE_CHANGED":
      return error.message;

    case "INVALID_ITEM":
      return "One of the cart items is invalid.";

    default:
      return (
        error.message ||
        "Checkout validation failed."
      );
  }
}
