import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

export const runtime = "nodejs";

type PricingType = "retail" | "wholesale";
type WholesaleUnit = "PIECE" | "SET";

type OrderItemRequest = {
  productId: string;
  sellerId: string;
  quantity: number;
  pricingType: PricingType;
  wholesaleUnit?: WholesaleUnit;
  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;
  setComposition?: SetCompositionItem[];
};

type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

type SetCompositionItem = {
  variantType?: string;
  value?: string;
  quantity: number;
  size?: string;
  color?: string;
};

type WholesaleConfiguration = {
  enabled?: boolean;
  saleUnit?: WholesaleUnit;
  setBreakAllowed?: boolean;
  setSize?: number;
  setName?: string;
  composition?: SetCompositionItem[];
  moqSets?: number;
  priceUnit?: WholesaleUnit;
  tiers?: WholesaleTier[];
};

type ProductData = {
  id: string;
  name: string;
  slug?: string;
  sellerId: string;
  sellerName?: string;
  status: "active" | "draft" | "out_of_stock" | "blocked";
  stock: number;
  mrp: number;
  retailPrice: number;
  wholesalePrice: number;
  moq: number;
  wholesaleTiers: WholesaleTier[];
  wholesaleConfiguration?: WholesaleConfiguration;
  sellingMode?: "PIECE" | "SET" | "BOTH";
  images: string[];
};

type OrderLineItem = {
  productId: string;
  sellerId: string;
  sellerName: string;
  productName: string;
  productSlug: string;
  image: string;
  quantity: number;
  pricingType: PricingType;
  mrp: number;
  unitPrice: number;
  subtotal: number;
  moq: number;

  wholesaleUnit?: WholesaleUnit;
  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;
  setComposition?: SetCompositionItem[];
};

type SellerGroup = {
  sellerId: string;
  sellerName: string;
  items: OrderLineItem[];
  subtotal: number;
};

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveInteger(value: unknown): boolean {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function normalizeTiers(value: unknown): WholesaleTier[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const tier = raw as Record<string, unknown>;
      const minQuantity = Number(tier.minQuantity);
      const price = Number(tier.price);
      const maxQuantity =
        tier.maxQuantity === undefined || tier.maxQuantity === null
          ? undefined
          : Number(tier.maxQuantity);

      if (!Number.isInteger(minQuantity) || minQuantity <= 0) return null;
      if (!Number.isFinite(price) || price <= 0) return null;
      if (
        maxQuantity !== undefined &&
        (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity)
      ) {
        return null;
      }

      return {
        minQuantity,
        ...(maxQuantity !== undefined ? { maxQuantity } : {}),
        price,
      };
    })
    .filter((tier): tier is WholesaleTier => tier !== null)
    .sort((a, b) => b.minQuantity - a.minQuantity);
}

function getTierForQuantity(
  tiers: WholesaleTier[],
  quantity: number
): WholesaleTier | null {
  return (
    tiers.find(
      (tier) =>
        quantity >= tier.minQuantity &&
        (tier.maxQuantity === undefined || quantity <= tier.maxQuantity)
    ) || null
  );
}

function normalizeComposition(value: unknown): SetCompositionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) return null;

      return {
        ...(item.variantType
          ? { variantType: String(item.variantType) }
          : {}),
        ...(item.value ? { value: String(item.value) } : {}),
        quantity,
        ...(item.size ? { size: String(item.size) } : {}),
        ...(item.color ? { color: String(item.color) } : {}),
      };
    })
    .filter((item): item is SetCompositionItem => item !== null);
}

function compositionSize(composition: SetCompositionItem[]): number {
  return composition.reduce((sum, item) => sum + item.quantity, 0);
}

function normalizeProduct(
  id: string,
  data: Record<string, unknown>
): ProductData {
  const rawStatus = data.status;
  const status =
    rawStatus === "draft" ||
    rawStatus === "out_of_stock" ||
    rawStatus === "blocked"
      ? rawStatus
      : "active";

  return {
    id,
    name: stringValue(data.name, "Product"),
    slug: stringValue(data.slug),
    sellerId: stringValue(data.sellerId),
    sellerName: stringValue(data.sellerName, "ANJIVO Seller"),
    status,
    stock: Math.max(0, Math.floor(numberValue(data.stock))),
    mrp: numberValue(data.mrp),
    retailPrice: numberValue(data.retailPrice),
    wholesalePrice: numberValue(data.wholesalePrice),
    moq: Math.max(1, Math.floor(numberValue(data.moq, 1))),
    wholesaleTiers: normalizeTiers(data.wholesaleTiers),
    wholesaleConfiguration:
      data.wholesaleConfiguration &&
      typeof data.wholesaleConfiguration === "object"
        ? (data.wholesaleConfiguration as WholesaleConfiguration)
        : undefined,
    sellingMode:
      data.sellingMode === "PIECE" ||
      data.sellingMode === "SET" ||
      data.sellingMode === "BOTH"
        ? data.sellingMode
        : undefined,
    images: Array.isArray(data.images)
      ? data.images.filter((x): x is string => typeof x === "string")
      : [],
  };
}

function validateShippingAddress(address: unknown): ShippingAddress {
  if (!address || typeof address !== "object") {
    throw new Error("Delivery address is required.");
  }

  const value = address as Record<string, unknown>;
  const fullName = stringValue(value.fullName);
  const phone = stringValue(value.phone);
  const addressLine1 = stringValue(value.addressLine1);
  const addressLine2 = stringValue(value.addressLine2);
  const city = stringValue(value.city);
  const state = stringValue(value.state);
  const pincode = stringValue(value.pincode);

  if (fullName.length < 2) {
    throw new Error("Please enter a valid full name.");
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new Error("Please enter a valid 10 digit mobile number.");
  }
  if (addressLine1.length < 5) {
    throw new Error("Please enter a complete delivery address.");
  }
  if (city.length < 2) {
    throw new Error("Please enter a valid city.");
  }
  if (state.length < 2) {
    throw new Error("Please enter a valid state.");
  }
  if (!/^\d{6}$/.test(pincode)) {
    throw new Error("Please enter a valid 6 digit pincode.");
  }

  return {
    fullName,
    phone,
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    city,
    state,
    pincode,
  };
}

function getWholesaleConfig(
  product: ProductData
): WholesaleConfiguration | null {
  const config = product.wholesaleConfiguration;
  if (!config || config.enabled === false) return null;
  return config;
}

function validateSetProduct(product: ProductData) {
  const config = getWholesaleConfig(product);

  if (!config || config.saleUnit !== "SET") {
    throw new Error(
      `${product.name}: wholesale set configuration is not available.`
    );
  }

  const setSize = Number(config.setSize);
  if (!Number.isInteger(setSize) || setSize <= 0) {
    throw new Error(`${product.name}: invalid set size configuration.`);
  }

  const composition = normalizeComposition(config.composition);
  if (composition.length === 0) {
    throw new Error(`${product.name}: set composition is missing.`);
  }

  if (compositionSize(composition) !== setSize) {
    throw new Error(
      `${product.name}: set composition does not match set size.`
    );
  }

  return {
    config,
    setSize,
    composition,
    moqSets: Math.max(1, Math.floor(numberValue(config.moqSets, 1))),
    setBreakAllowed: config.setBreakAllowed === true,
    setName: stringValue(config.setName),
  };
}

function getAvailableSets(product: ProductData, setSize: number): number {
  return Math.floor(Math.max(0, product.stock) / setSize);
}

export async function POST(request: Request) {
  try {
    /*
     * ============================================================
     * 1. AUTHENTICATE
     * ============================================================
     *
     * userId is ALWAYS derived from the verified Firebase token.
     * The browser cannot choose the customer identity.
     */
    const decodedToken = await verifyIdToken(
      request.headers.get("authorization")
    );
    const userId = decodedToken.uid;

    const body = await request.json();

    const paymentMethod =
      body?.paymentMethod === "ONLINE" ? "ONLINE" : "COD";

    const shippingAddress = validateShippingAddress(
      body?.shippingAddress
    );

    const rawItems = body?.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Your cart is empty." },
        { status: 400 }
      );
    }

    if (rawItems.length > 100) {
      return NextResponse.json(
        { success: false, message: "Too many order items." },
        { status: 400 }
      );
    }

    /*
     * ============================================================
     * 2. NORMALIZE REQUEST
     * ============================================================
     *
     * Price is NEVER accepted from the client.
     * Set metadata is also revalidated against Firestore.
     */
    const requestedItems: OrderItemRequest[] = [];
    const seenKeys = new Set<string>();

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") {
        throw new Error("Invalid order item.");
      }

      const item = rawItem as Record<string, unknown>;

      const productId = stringValue(item.productId ?? item.id);
      const sellerId = stringValue(item.sellerId);
      const quantity = Math.floor(numberValue(item.quantity));

      const pricingType: PricingType =
        item.pricingType === "wholesale" ? "wholesale" : "retail";

      const wholesaleUnit =
        item.wholesaleUnit === "SET" || item.wholesaleUnit === "PIECE"
          ? item.wholesaleUnit
          : undefined;

      const piecesPerSet =
        item.piecesPerSet !== undefined
          ? Math.floor(numberValue(item.piecesPerSet))
          : undefined;

      const setName =
        typeof item.setName === "string"
          ? item.setName.trim()
          : undefined;

      const setBreakAllowed =
        typeof item.setBreakAllowed === "boolean"
          ? item.setBreakAllowed
          : undefined;

      const setComposition = normalizeComposition(
        item.setComposition
      );

      if (!productId || !sellerId) {
        throw new Error("Invalid product or seller information.");
      }

      if (!positiveInteger(quantity)) {
        throw new Error("Invalid product quantity.");
      }

      const key = [
        productId,
        sellerId,
        pricingType,
        wholesaleUnit || "NONE",
        piecesPerSet || 0,
        setName || "",
      ].join("|");

      if (seenKeys.has(key)) {
        throw new Error(
          "Duplicate order item detected. Please refresh your cart."
        );
      }

      seenKeys.add(key);

      requestedItems.push({
        productId,
        sellerId,
        quantity,
        pricingType,
        ...(wholesaleUnit ? { wholesaleUnit } : {}),
        ...(piecesPerSet ? { piecesPerSet } : {}),
        ...(setName ? { setName } : {}),
        ...(setBreakAllowed !== undefined ? { setBreakAllowed } : {}),
        ...(setComposition.length > 0 ? { setComposition } : {}),
      });
    }

    /*
     * ============================================================
     * 3. ATOMIC FIRESTORE TRANSACTION
     * ============================================================
     *
     * All product reads happen before any writes.
     * Order + sellerOrders + inventory + transaction + audit log
     * are committed together.
     */
    const result = await adminDb.runTransaction(async (transaction) => {
      const products = new Map<string, ProductData>();
      const productRefs = new Map<string, FirebaseFirestore.DocumentReference>();

      for (const item of requestedItems) {
        if (products.has(item.productId)) continue;

        const productRef = adminDb
          .collection("products")
          .doc(item.productId);

        const snapshot = await transaction.get(productRef);

        if (!snapshot.exists) {
          throw new Error(
            `Product ${item.productId} no longer exists.`
          );
        }

        products.set(
          item.productId,
          normalizeProduct(
            item.productId,
            snapshot.data() as Record<string, unknown>
          )
        );

        productRefs.set(item.productId, productRef);
      }

      /*
       * ----------------------------------------------------------
       * USER / WHOLESALE ELIGIBILITY
       * ----------------------------------------------------------
       */
      const userSnapshot = await transaction.get(
        adminDb.collection("users").doc(userId)
      );

      if (!userSnapshot.exists) {
        throw new Error("Customer account was not found.");
      }

      const userData = userSnapshot.data() || {};
      const accountStatus = userData.accountStatus;

      if (
        accountStatus &&
        accountStatus !== "ACTIVE"
      ) {
        throw new Error("Your account is not active yet.");
      }

      const isWholesaleCustomer =
        userData.role === "WHOLESALE_CUSTOMER" ||
        userData.customerType === "WHOLESALE_CUSTOMER";

      const containsWholesale = requestedItems.some(
        (item) => item.pricingType === "wholesale"
      );

      if (containsWholesale && !isWholesaleCustomer) {
        throw new Error(
          "Wholesale pricing is available only to approved wholesale customers."
        );
      }

      /*
       * ----------------------------------------------------------
       * AGGREGATED INVENTORY REQUIREMENTS
       * ----------------------------------------------------------
       *
       * Product stock is currently piece-based.
       * A SET consumes quantity × piecesPerSet.
       */
      const requiredPieces = new Map<string, number>();

      const orderItems: OrderLineItem[] = [];
      const sellerMap = new Map<string, SellerGroup>();

      let subtotal = 0;

      for (const item of requestedItems) {
        const product = products.get(item.productId);

        if (!product) {
          throw new Error("Product validation failed.");
        }

        if (product.sellerId !== item.sellerId) {
          throw new Error(
            `${product.name}: seller information has changed. Please refresh your cart.`
          );
        }

        if (product.status !== "active") {
          throw new Error(
            `${product.name} is currently unavailable.`
          );
        }

        const currentStock = Math.max(
          0,
          Math.floor(product.stock)
        );

        if (currentStock <= 0) {
          throw new Error(`${product.name} is out of stock.`);
        }

        let stockConsumption = item.quantity;
        let unitPrice = 0;
        let moq = product.moq;

        const lineSnapshot: Partial<OrderLineItem> = {};

        /*
         * ========================================================
         * RETAIL
         * ========================================================
         */
        if (item.pricingType === "retail") {
          if (product.sellingMode === "SET") {
            throw new Error(
              `${product.name}: retail piece purchase is not available.`
            );
          }

          if (product.retailPrice <= 0) {
            throw new Error(
              `${product.name}: retail price is not configured.`
            );
          }

          unitPrice = product.retailPrice;
        }

        /*
         * ========================================================
         * WHOLESALE
         * ========================================================
         */
        else {
          const config = getWholesaleConfig(product);

          if (!config) {
            throw new Error(
              `${product.name}: wholesale configuration is missing.`
            );
          }

          if (config.saleUnit !== "PIECE" && config.saleUnit !== "SET") {
            throw new Error(
              `${product.name}: invalid wholesale unit configuration.`
            );
          }

          /*
           * ------------------------------------------------------
           * WHOLESALE PIECE
           * ------------------------------------------------------
           */
          if (config.saleUnit === "PIECE") {
            if (
              item.wholesaleUnit &&
              item.wholesaleUnit !== "PIECE"
            ) {
              throw new Error(
                `${product.name}: wholesale unit mismatch.`
              );
            }

            moq = Math.max(1, product.moq);

            if (item.quantity < moq) {
              throw new Error(
                `${product.name}: minimum wholesale quantity is ${moq} pieces.`
              );
            }

            const tiers = normalizeTiers(
              Array.isArray(config.tiers) && config.tiers.length > 0
                ? config.tiers
                : product.wholesaleTiers
            );

            const tier = getTierForQuantity(
              tiers,
              item.quantity
            );

            if (!tier) {
              throw new Error(
                `${product.name}: no wholesale price tier is available for ${item.quantity} pieces.`
              );
            }

            unitPrice = tier.price;
            lineSnapshot.wholesaleUnit = "PIECE";
          }

          /*
           * ------------------------------------------------------
           * WHOLESALE SET / PACK
           * ------------------------------------------------------
           */
          else {
            const setData = validateSetProduct(product);

            if (
              item.wholesaleUnit &&
              item.wholesaleUnit !== "SET"
            ) {
              throw new Error(
                `${product.name}: wholesale unit mismatch.`
              );
            }

            if (
              item.piecesPerSet !== undefined &&
              item.piecesPerSet !== setData.setSize
            ) {
              throw new Error(
                `${product.name}: set size mismatch.`
              );
            }

            if (
              item.setName &&
              setData.setName &&
              item.setName !== setData.setName
            ) {
              throw new Error(
                `${product.name}: set name/configuration mismatch.`
              );
            }

            if (
              item.setBreakAllowed !== undefined &&
              item.setBreakAllowed !== setData.setBreakAllowed
            ) {
              throw new Error(
                `${product.name}: set-break configuration mismatch.`
              );
            }

            if (
              item.setComposition &&
              JSON.stringify(item.setComposition) !==
                JSON.stringify(setData.composition)
            ) {
              throw new Error(
                `${product.name}: set composition has changed. Please refresh your cart.`
              );
            }

            moq = setData.moqSets;

            if (item.quantity < moq) {
              throw new Error(
                `${product.name}: minimum wholesale quantity is ${moq} sets.`
              );
            }

            const availableSets = Math.floor(
              currentStock / setData.setSize
            );

            if (item.quantity > availableSets) {
              throw new Error(
                `${product.name}: only ${availableSets} sets are currently available.`
              );
            }

            const tiers = normalizeTiers(
              setData.config.tiers
            );

            const tier = getTierForQuantity(
              tiers,
              item.quantity
            );

            if (!tier) {
              throw new Error(
                `${product.name}: no wholesale set price tier is available for ${item.quantity} sets.`
              );
            }

            unitPrice = tier.price;

            /*
             * IMPORTANT:
             * Set price is PER SET.
             */
            stockConsumption =
              item.quantity * setData.setSize;

            lineSnapshot.wholesaleUnit = "SET";
            lineSnapshot.piecesPerSet = setData.setSize;
            lineSnapshot.setName =
              setData.setName || undefined;
            lineSnapshot.setBreakAllowed =
              setData.setBreakAllowed;
            lineSnapshot.setComposition =
              setData.composition;
          }
        }

        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new Error(
            `${product.name}: invalid server price configuration.`
          );
        }

        /*
         * Aggregate inventory consumption across all lines.
         */
        requiredPieces.set(
          product.id,
          (requiredPieces.get(product.id) || 0) +
            stockConsumption
        );

        const lineSubtotal =
          unitPrice * item.quantity;

        const orderItem: OrderLineItem = {
          productId: product.id,
          sellerId: product.sellerId,
          sellerName:
            product.sellerName || "ANJIVO Seller",
          productName: product.name,
          productSlug: product.slug || "",
          image: product.images[0] || "",
          quantity: item.quantity,
          pricingType: item.pricingType,
          mrp: product.mrp,
          unitPrice,
          subtotal: lineSubtotal,
          moq,
          ...lineSnapshot,
        };

        orderItems.push(orderItem);
        subtotal += lineSubtotal;

        const existingSeller = sellerMap.get(
          product.sellerId
        );

        if (existingSeller) {
          existingSeller.items.push(orderItem);
          existingSeller.subtotal += lineSubtotal;
        } else {
          sellerMap.set(product.sellerId, {
            sellerId: product.sellerId,
            sellerName:
              product.sellerName || "ANJIVO Seller",
            items: [orderItem],
            subtotal: lineSubtotal,
          });
        }
      }

      /*
       * ----------------------------------------------------------
       * FINAL AGGREGATED STOCK CHECK
       * ----------------------------------------------------------
       */
      for (const [
        productId,
        required,
      ] of requiredPieces) {
        const product = products.get(productId);

        if (!product) {
          throw new Error("Product not found.");
        }

        if (required > product.stock) {
          throw new Error(
            `${product.name}: insufficient stock. Available ${product.stock} pieces, required ${required} pieces.`
          );
        }
      }

      /*
       * ----------------------------------------------------------
       * COMMERCE TOTALS
       * ----------------------------------------------------------
       */
      const shippingCharge = 0;
      const discount = 0;
      const tax = 0;

      const total = Math.max(
        0,
        subtotal +
          shippingCharge +
          tax -
          discount
      );

      const sellerGroups = Array.from(
        sellerMap.values()
      );

      /*
       * ----------------------------------------------------------
       * CREATE PARENT ORDER
       * ----------------------------------------------------------
       */
      const orderRef = adminDb
        .collection("orders")
        .doc();

      const orderId = orderRef.id;

      transaction.set(orderRef, {
        id: orderId,
        userId,
        customerId: userId,

        shippingAddress,

        items: orderItems,

        sellerIds: sellerGroups.map(
          (seller) => seller.sellerId
        ),
        sellerCount: sellerGroups.length,

        subtotal,
        shippingCharge,
        discount,
        tax,
        total,
        currency: "INR",

        paymentMethod,
        paymentStatus:
          paymentMethod === "COD"
            ? "PENDING"
            : "PENDING",

        orderStatus: "PLACED",
        fulfillmentStatus: "PENDING",

        pricingTypes: Array.from(
          new Set(
            orderItems.map(
              (item) => item.pricingType
            )
          )
        ),

        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      });

      /*
       * ----------------------------------------------------------
       * CREATE SELLER ORDERS
       * ----------------------------------------------------------
       */
      for (const seller of sellerGroups) {
        const sellerOrderRef = adminDb
          .collection("sellerOrders")
          .doc();

        transaction.set(sellerOrderRef, {
          id: sellerOrderRef.id,
          orderId,

          sellerId: seller.sellerId,
          sellerName: seller.sellerName,

          customerId: userId,

          items: seller.items,

          subtotal: seller.subtotal,
          shippingCharge: 0,
          discount: 0,
          tax: 0,
          total: seller.subtotal,

          paymentStatus: "PENDING",
          orderStatus: "PLACED",
          fulfillmentStatus: "PENDING",

          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        });
      }

      /*
       * ----------------------------------------------------------
       * DEDUCT INVENTORY
       * ----------------------------------------------------------
       *
       * For SET:
       * quantity × piecesPerSet is deducted.
       */
      for (const [
        productId,
        required,
      ] of requiredPieces) {
        const product = products.get(productId);
        const productRef = productRefs.get(productId);

        if (!product || !productRef) {
          throw new Error(
            "Product not found during inventory update."
          );
        }

        const newStock =
          product.stock - required;

        transaction.update(productRef, {
          stock: newStock,
          status:
            newStock <= 0
              ? "out_of_stock"
              : "active",
          updatedAt:
            FieldValue.serverTimestamp(),
        });
      }

      /*
       * ----------------------------------------------------------
       * TRANSACTION RECORD
       * ----------------------------------------------------------
       */
      const transactionRef = adminDb
        .collection("transactions")
        .doc();

      transaction.set(transactionRef, {
        id: transactionRef.id,
        orderId,
        userId,

        type: "ORDER_CREATED",

        paymentMethod,
        paymentStatus: "PENDING",

        amount: total,
        currency: "INR",

        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      });

      /*
       * ----------------------------------------------------------
       * AUDIT LOG
       * ----------------------------------------------------------
       */
      const auditRef = adminDb
        .collection("auditLogs")
        .doc();

      transaction.set(auditRef, {
        id: auditRef.id,

        action: "ORDER_CREATED",
        actionType: "CREATE",
        category: "ORDER",

        description:
          "Customer order created through secure checkout API.",

        actorId: userId,
        actorRole: "CUSTOMER",

        targetId: orderId,
        targetType: "ORDER",
        orderId,

        metadata: {
          paymentMethod,
          sellerCount: sellerGroups.length,
          itemCount: orderItems.length,
          total,
        },

        createdAt:
          FieldValue.serverTimestamp(),
      });

      return {
        orderId,
        subtotal,
        shippingCharge,
        discount,
        tax,
        total,
        sellerCount: sellerGroups.length,
        itemCount: orderItems.length,
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Order created successfully.",
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order creation error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create order.";

    const lowerMessage =
      message.toLowerCase();

    const isAuthError =
      lowerMessage.includes("authentication") ||
      lowerMessage.includes("token") ||
      lowerMessage.includes("unauthorized");

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: isAuthError ? 401 : 400,
      }
    );
  }
}
