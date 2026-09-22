import { NextResponse } from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  getAdminApp,
} from "@/lib/firebase-admin";

import {
  verifyIdToken,
} from "@/lib/firebase-admin-auth";

import {
  getFirestore,
} from "firebase-admin/firestore";

export const runtime = "nodejs";

type OrderItemRequest = {
  productId: string;
  sellerId: string;
  quantity: number;
  pricingType: "retail" | "wholesale";
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

type ProductData = {
  id: string;
  name: string;
  slug?: string;

  sellerId: string;
  sellerName?: string;

  status:
    | "active"
    | "draft"
    | "out_of_stock"
    | "blocked";

  stock: number;

  mrp: number;
  retailPrice: number;
  wholesalePrice: number;

  moq: number;

  wholesaleTiers?: {
    minQuantity: number;
    maxQuantity?: number;
    price: number;
  }[];

  images?: string[];
};

type OrderLineItem = {
  productId: string;
  sellerId: string;
  sellerName: string;

  productName: string;
  productSlug: string;

  image: string;

  quantity: number;

  pricingType: "retail" | "wholesale";

  mrp: number;
  unitPrice: number;
  subtotal: number;

  moq: number;
};

type SellerGroup = {
  sellerId: string;
  sellerName: string;
  items: OrderLineItem[];
  subtotal: number;
};

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function numberValue(
  value: unknown,
  fallback = 0
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function getWholesalePrice(
  product: ProductData,
  quantity: number
): number {
  const tiers =
    Array.isArray(
      product.wholesaleTiers
    )
      ? [...product.wholesaleTiers]
      : [];

  tiers.sort(
    (a, b) =>
      numberValue(
        b.minQuantity
      ) -
      numberValue(
        a.minQuantity
      )
  );

  const matchingTier =
    tiers.find(
      (tier) =>
        quantity >=
          numberValue(
            tier.minQuantity
          ) &&
        (
          tier.maxQuantity ===
            undefined ||
          quantity <=
            numberValue(
              tier.maxQuantity
            )
        )
    );

  if (matchingTier) {
    return numberValue(
      matchingTier.price
    );
  }

  return numberValue(
    product.wholesalePrice
  );
}

function normaliseProduct(
  id: string,
  data: Record<string, unknown>
): ProductData {
  const status =
    data.status === "draft" ||
    data.status === "out_of_stock" ||
    data.status === "blocked"
      ? data.status
      : "active";

  return {
    id,

    name: stringValue(
      data.name,
      "Product"
    ),

    slug: stringValue(
      data.slug
    ),

    sellerId: stringValue(
      data.sellerId
    ),

    sellerName: stringValue(
      data.sellerName,
      "ANJIVO Seller"
    ),

    status,

    stock: numberValue(
      data.stock
    ),

    mrp: numberValue(
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

    moq: Math.max(
      1,
      numberValue(
        data.moq,
        1
      )
    ),

    wholesaleTiers:
      Array.isArray(
        data.wholesaleTiers
      )
        ? data.wholesaleTiers
            .filter(
              (tier) =>
                tier &&
                typeof tier ===
                  "object"
            )
            .map(
              (tier) =>
                tier as {
                  minQuantity: number;
                  maxQuantity?: number;
                  price: number;
                }
            )
        : [],

    images:
      Array.isArray(
        data.images
      )
        ? data.images.filter(
            (image) =>
              typeof image ===
              "string"
          )
        : [],
  };
}

function validateShippingAddress(
  address: unknown
): ShippingAddress {
  if (
    !address ||
    typeof address !== "object"
  ) {
    throw new Error(
      "Delivery address is required."
    );
  }

  const value =
    address as Record<
      string,
      unknown
    >;

  const fullName =
    stringValue(
      value.fullName
    );

  const phone =
    stringValue(
      value.phone
    );

  const addressLine1 =
    stringValue(
      value.addressLine1
    );

  const addressLine2 =
    stringValue(
      value.addressLine2
    );

  const city =
    stringValue(
      value.city
    );

  const state =
    stringValue(
      value.state
    );

  const pincode =
    stringValue(
      value.pincode
    );

  if (
    fullName.length < 2
  ) {
    throw new Error(
      "Please enter a valid full name."
    );
  }

  if (
    !/^[6-9]\d{9}$/.test(
      phone
    )
  ) {
    throw new Error(
      "Please enter a valid 10 digit mobile number."
    );
  }

  if (
    addressLine1.length < 5
  ) {
    throw new Error(
      "Please enter a complete delivery address."
    );
  }

  if (
    city.length < 2
  ) {
    throw new Error(
      "Please enter a valid city."
    );
  }

  if (
    state.length < 2
  ) {
    throw new Error(
      "Please enter a valid state."
    );
  }

  if (
    !/^\d{6}$/.test(
      pincode
    )
  ) {
    throw new Error(
      "Please enter a valid 6 digit pincode."
    );
  }

  return {
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
  };
}

function createId(
  prefix: string
): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function POST(
  request: Request
) {
  try {
    /*
     * ------------------------------------------------
     * 1. VERIFY FIREBASE AUTH TOKEN
     * ------------------------------------------------
     *
     * We do NOT trust userId coming from the
     * browser request body.
     */

    const decodedToken =
      await verifyIdToken(
        request.headers.get(
          "authorization"
        )
      );

    const userId =
      decodedToken.uid;

    /*
     * ------------------------------------------------
     * 2. READ REQUEST
     * ------------------------------------------------
     */

    const body =
      await request.json();

    const paymentMethod =
      body?.paymentMethod ===
      "ONLINE"
        ? "ONLINE"
        : "COD";

    const shippingAddress =
      validateShippingAddress(
        body?.shippingAddress
      );

    const rawItems =
      body?.items;

    if (
      !Array.isArray(
        rawItems
      ) ||
      rawItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your cart is empty.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ------------------------------------------------
     * 3. NORMALISE CART ITEMS
     * ------------------------------------------------
     *
     * Client supplies only:
     * productId
     * sellerId
     * quantity
     * pricingType
     *
     * Price is NEVER accepted from client.
     */

    const itemMap =
      new Map<
        string,
        OrderItemRequest
      >();

    for (
      const rawItem of rawItems
    ) {
      if (
        !rawItem ||
        typeof rawItem !==
          "object"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid order item.",
          },
          {
            status: 400,
          }
        );
      }

      const item =
        rawItem as Record<
          string,
          unknown
        >;

      const productId =
        stringValue(
          item.productId ??
            item.id
        );

      const sellerId =
        stringValue(
          item.sellerId
        );

      const quantity =
        Math.floor(
          numberValue(
            item.quantity
          )
        );

      const pricingType =
        item.pricingType ===
        "wholesale"
          ? "wholesale"
          : "retail";

      if (
        !productId ||
        !sellerId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid product or seller information.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        quantity <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid product quantity.",
          },
          {
            status: 400,
          }
        );
      }

      const key = [
        productId,
        sellerId,
        pricingType,
      ].join("|");

      const existing =
        itemMap.get(key);

      if (existing) {
        existing.quantity +=
          quantity;
      } else {
        itemMap.set(
          key,
          {
            productId,
            sellerId,
            quantity,
            pricingType,
          }
        );
      }
    }

    const requestedItems =
      Array.from(
        itemMap.values()
      );

    /*
     * ------------------------------------------------
     * 4. ADMIN FIRESTORE
     * ------------------------------------------------
     */

    const adminDb =
      getFirestore(
        getAdminApp()
      );

    /*
     * ------------------------------------------------
     * 5. TRUSTED FIRESTORE TRANSACTION
     * ------------------------------------------------
     *
     * Product read + validation + order creation
     * + seller orders + stock deduction happen
     * inside one trusted transaction.
     */

    const result =
      await adminDb.runTransaction(
        async (transaction) => {
          const products =
            new Map<
              string,
              ProductData
            >();

          /*
           * Firestore transaction rule:
           * perform reads before writes.
           */

          for (
            const item of requestedItems
          ) {
            if (
              products.has(
                item.productId
              )
            ) {
              continue;
            }

            const productRef =
              adminDb
                .collection(
                  "products"
                )
                .doc(
                  item.productId
                );

            const snapshot =
              await transaction.get(
                productRef
              );

            if (
              !snapshot.exists
            ) {
              throw new Error(
                `Product ${item.productId} no longer exists.`
              );
            }

            products.set(
              item.productId,
              normaliseProduct(
                item.productId,
                snapshot.data() as Record<
                  string,
                  unknown
                >
              )
            );
          }

          /*
           * ------------------------------------------------
           * 6. VALIDATE + CALCULATE SERVER PRICE
           * ------------------------------------------------
           */

          const orderItems: OrderLineItem[] =
            [];

          const sellerMap =
            new Map<
              string,
              SellerGroup
            >();

          let subtotal = 0;

          for (
            const item of requestedItems
          ) {
            const product =
              products.get(
                item.productId
              );

            if (!product) {
              throw new Error(
                "Product validation failed."
              );
            }

            /*
             * Seller ownership
             */
            if (
              product.sellerId !==
              item.sellerId
            ) {
              throw new Error(
                `${product.name}: seller information has changed. Please refresh your cart.`
              );
            }

            /*
             * Product status
             */
            if (
              product.status !==
              "active"
            ) {
              throw new Error(
                `${product.name} is currently unavailable.`
              );
            }

            /*
             * Stock
             */
            if (
              product.stock <= 0
            ) {
              throw new Error(
                `${product.name} is out of stock.`
              );
            }

            if (
              item.quantity >
              product.stock
            ) {
              throw new Error(
                `${product.name}: only ${product.stock} units are available.`
              );
            }

            /*
             * Wholesale MOQ
             */
            if (
              item.pricingType ===
              "wholesale"
            ) {
              if (
                item.quantity <
                product.moq
              ) {
                throw new Error(
                  `${product.name}: minimum wholesale quantity is ${product.moq}.`
                );
              }
            }

            /*
             * SERVER-SIDE PRICE
             */
            const unitPrice =
              item.pricingType ===
              "wholesale"
                ? getWholesalePrice(
                    product,
                    item.quantity
                  )
                : product.retailPrice;

            if (
              !Number.isFinite(
                unitPrice
              ) ||
              unitPrice < 0
            ) {
              throw new Error(
                `${product.name} has an invalid price configuration.`
              );
            }

            const lineSubtotal =
              unitPrice *
              item.quantity;

            const orderItem:
              OrderLineItem =
              {
                productId:
                  product.id,

                sellerId:
                  product.sellerId,

                sellerName:
                  product.sellerName ||
                  "ANJIVO Seller",

                productName:
                  product.name,

                productSlug:
                  product.slug ||
                  "",

                image:
                  product.images?.[0] ||
                  "",

                quantity:
                  item.quantity,

                pricingType:
                  item.pricingType,

                mrp:
                  product.mrp,

                unitPrice,

                subtotal:
                  lineSubtotal,

                moq:
                  product.moq,
              };

            orderItems.push(
              orderItem
            );

            subtotal +=
              lineSubtotal;

            const existingSeller =
              sellerMap.get(
                product.sellerId
              );

            if (
              existingSeller
            ) {
              existingSeller.items.push(
                orderItem
              );

              existingSeller.subtotal +=
                lineSubtotal;
            } else {
              sellerMap.set(
                product.sellerId,
                {
                  sellerId:
                    product.sellerId,

                  sellerName:
                    product.sellerName ||
                    "ANJIVO Seller",

                  items: [
                    orderItem,
                  ],

                  subtotal:
                    lineSubtotal,
                }
              );
            }
          }

          /*
           * ------------------------------------------------
           * 7. CURRENT COMMERCE CALCULATIONS
           * ------------------------------------------------
           *
           * Shipping, coupon and tax engines will
           * be connected separately.
           */

          const shippingCharge =
            0;

          const discount =
            0;

          const tax =
            0;

          const total =
            Math.max(
              0,
              subtotal +
                shippingCharge +
                tax -
                discount
            );

          /*
           * ------------------------------------------------
           * 8. SELLER GROUPS
           * ------------------------------------------------
           */

          const sellerGroups =
            Array.from(
              sellerMap.values()
            );

          /*
           * ------------------------------------------------
           * 9. CREATE PARENT ORDER
           * ------------------------------------------------
           */

          const orderRef =
            adminDb
              .collection(
                "orders"
              )
              .doc();

          const orderId =
            orderRef.id;

          transaction.set(
            orderRef,
            {
              id:
                orderId,

              userId,

              customerId:
                userId,

              shippingAddress,

              items:
                orderItems,

              sellerIds:
                sellerGroups.map(
                  (seller) =>
                    seller.sellerId
                ),

              sellerCount:
                sellerGroups.length,

              subtotal,

              shippingCharge,

              discount,

              tax,

              total,

              currency:
                "INR",

              paymentMethod,

              paymentStatus:
                "PENDING",

              orderStatus:
                "PLACED",

              fulfillmentStatus:
                "PENDING",

              pricingTypes:
                Array.from(
                  new Set(
                    orderItems.map(
                      (item) =>
                        item.pricingType
                    )
                  )
                ),

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          /*
           * ------------------------------------------------
           * 10. CREATE SELLER ORDERS
           * ------------------------------------------------
           */

          for (
            const seller of sellerGroups
          ) {
            const sellerOrderRef =
              adminDb
                .collection(
                  "sellerOrders"
                )
                .doc();

            transaction.set(
              sellerOrderRef,
              {
                id:
                  sellerOrderRef.id,

                orderId,

                sellerId:
                  seller.sellerId,

                sellerName:
                  seller.sellerName,

                customerId:
                  userId,

                items:
                  seller.items,

                subtotal:
                  seller.subtotal,

                shippingCharge:
                  0,

                discount:
                  0,

                tax:
                  0,

                total:
                  seller.subtotal,

                paymentStatus:
                  "PENDING",

                orderStatus:
                  "PLACED",

                fulfillmentStatus:
                  "PENDING",

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp(),
              }
            );
          }

          /*
           * ------------------------------------------------
           * 11. DEDUCT INVENTORY
           * ------------------------------------------------
           *
           * Same transaction.
           */

          for (
            const item of requestedItems
          ) {
            const product =
              products.get(
                item.productId
              );

            if (!product) {
              throw new Error(
                "Product not found during inventory update."
              );
            }

            const productRef =
              adminDb
                .collection(
                  "products"
                )
                .doc(
                  item.productId
                );

            const newStock =
              product.stock -
              item.quantity;

            transaction.update(
              productRef,
              {
                stock:
                  newStock,

                status:
                  newStock <= 0
                    ? "out_of_stock"
                    : "active",

                updatedAt:
                  FieldValue.serverTimestamp(),
              }
            );
          }

          /*
           * ------------------------------------------------
           * 12. TRANSACTION RECORD
           * ------------------------------------------------
           */

          const transactionRef =
            adminDb
              .collection(
                "transactions"
              )
              .doc();

          transaction.set(
            transactionRef,
            {
              id:
                transactionRef.id,

              orderId,

              userId,

              type:
                "ORDER_CREATED",

              paymentMethod,

              paymentStatus:
                "PENDING",

              amount:
                total,

              currency:
                "INR",

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          /*
           * ------------------------------------------------
           * 13. AUDIT LOG
           * ------------------------------------------------
           */

          const auditRef =
            adminDb
              .collection(
                "auditLogs"
              )
              .doc();

          transaction.set(
            auditRef,
            {
              id:
                auditRef.id,

              action:
                "ORDER_CREATED",

              actionType:
                "CREATE",

              category:
                "ORDER",

              description:
                "Customer order created through secure checkout API.",

              actorId:
                userId,

              actorRole:
                "CUSTOMER",

              targetId:
                orderId,

              targetType:
                "ORDER",

              orderId,

              metadata: {
                paymentMethod,

                sellerCount:
                  sellerGroups.length,

                itemCount:
                  orderItems.length,

                total,
              },

              createdAt:
                FieldValue.serverTimestamp(),
            }
          );

          /*
           * ------------------------------------------------
           * 14. RETURN RESULT
           * ------------------------------------------------
           */

          return {
            orderId,

            subtotal,

            shippingCharge,

            discount,

            tax,

            total,

            sellerCount:
              sellerGroups.length,

            itemCount:
              orderItems.length,
          };
        }
      );

    /*
     * ------------------------------------------------
     * 15. SUCCESS
     * ------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        message:
          "Order created successfully.",

        ...result,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Order creation error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create order.";

    const lowerMessage =
      message.toLowerCase();

    const isAuthError =
      lowerMessage.includes(
        "authentication"
      ) ||
      lowerMessage.includes(
        "token"
      ) ||
      lowerMessage.includes(
        "unauthorized"
      );

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status:
          isAuthError
            ? 401
            : 400,
      }
    );
  }
}
