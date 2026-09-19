import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  getCart,
  getWholesalePrice,
} from "@/lib/cart";

export type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderItem = {
  productId: string;
  sellerId: string;
  sellerName?: string;

  name: string;
  slug: string;
  image?: string;

  quantity: number;

  mrp: number;
  selectedPrice: number;

  pricingType: "retail" | "wholesale";

  moq: number;

  subtotal: number;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type Order = {
  id: string;

  userId: string;

  customerName?: string;
  customerEmail?: string;

  sellerIds: string[];

  items: OrderItem[];

  shippingAddress: ShippingAddress;

  paymentMethod: string;
  paymentStatus: string;

  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;

  status: OrderStatus;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateOrderInput = {
  userId: string;

  shippingAddress: ShippingAddress;

  paymentMethod: "COD";
};

export type CreatedOrder = {
  orderId: string;

  totalAmount: number;

  subtotal: number;

  shippingCharge: number;

  discount: number;
};

/* ----------------------------------------
   Helpers
---------------------------------------- */

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function mapOrder(
  id: string,
  data: any
): Order {
  return {
    id,

    userId:
      data.userId || "",

    customerName:
      data.customerName || "",

    customerEmail:
      data.customerEmail || "",

    sellerIds:
      Array.isArray(data.sellerIds)
        ? data.sellerIds
        : [],

    items:
      Array.isArray(data.items)
        ? data.items.map(
            (item: any) => ({
              productId:
                item.productId || "",

              sellerId:
                item.sellerId || "",

              sellerName:
                item.sellerName || "",

              name:
                item.name ||
                "Product",

              slug:
                item.slug || "",

              image:
                item.image || "",

              quantity:
                Number(
                  item.quantity || 0
                ),

              mrp:
                Number(
                  item.mrp || 0
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

              moq:
                Number(
                  item.moq || 1
                ),

              subtotal:
                Number(
                  item.subtotal || 0
                ),
            })
          )
        : [],

    shippingAddress: {
      fullName:
        data.shippingAddress
          ?.fullName || "",

      phone:
        data.shippingAddress
          ?.phone || "",

      addressLine1:
        data.shippingAddress
          ?.addressLine1 || "",

      addressLine2:
        data.shippingAddress
          ?.addressLine2 || "",

      city:
        data.shippingAddress
          ?.city || "",

      state:
        data.shippingAddress
          ?.state || "",

      pincode:
        data.shippingAddress
          ?.pincode || "",
    },

    paymentMethod:
      data.paymentMethod ||
      "COD",

    paymentStatus:
      data.paymentStatus ||
      "pending",

    subtotal:
      Number(
        data.subtotal || 0
      ),

    shippingCharge:
      Number(
        data.shippingCharge || 0
      ),

    discount:
      Number(
        data.discount || 0
      ),

    totalAmount:
      Number(
        data.totalAmount || 0
      ),

    status:
      data.status || "pending",

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* ----------------------------------------
   Get Single Customer Order
---------------------------------------- */

export async function getOrderById(
  orderId: string,
  userId: string
): Promise<Order | null> {
  if (!orderId || !userId) {
    return null;
  }

  const orderRef = doc(
    db,
    "orders",
    orderId
  );

  const orderSnap =
    await getDoc(orderRef);

  if (!orderSnap.exists()) {
    return null;
  }

  const data =
    orderSnap.data();

  /*
   * Security check:
   * Customer can only access
   * their own order.
   */

  if (
    data.userId !== userId
  ) {
    return null;
  }

  return mapOrder(
    orderSnap.id,
    data
  );
}

/* ----------------------------------------
   Get All Orders Of Customer
---------------------------------------- */

export async function getUserOrders(
  userId: string
): Promise<Order[]> {
  if (!userId) {
    return [];
  }

  const ordersRef =
    collection(
      db,
      "orders"
    );

  const ordersQuery =
    query(
      ordersRef,
      where(
        "userId",
        "==",
        userId
      )
    );

  const snapshot =
    await getDocs(
      ordersQuery
    );

  const orders =
    snapshot.docs.map(
      (orderDoc) =>
        mapOrder(
          orderDoc.id,
          orderDoc.data()
        )
    );

  /*
   * Sort newest first.
   *
   * We are sorting in JavaScript
   * so this function does not require
   * a composite Firestore index.
   */

  orders.sort(
    (a, b) => {
      const aTime =
        getTimestampValue(
          a.createdAt
        );

      const bTime =
        getTimestampValue(
          b.createdAt
        );

      return bTime - aTime;
    }
  );

  return orders;
}

/* ----------------------------------------
   Timestamp Helper
---------------------------------------- */

function getTimestampValue(
  value: unknown
): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const time =
      new Date(value).getTime();

    return Number.isNaN(time)
      ? 0
      : time;
  }

  return 0;
}

/* ----------------------------------------
   Address Validation
---------------------------------------- */

function isValidAddress(
  address: ShippingAddress
): boolean {
  return (
    clean(
      address.fullName
    ).length >= 2 &&

    clean(
      address.phone
    ).length >= 10 &&

    clean(
      address.addressLine1
    ).length >= 5 &&

    clean(
      address.city
    ).length >= 2 &&

    clean(
      address.state
    ).length >= 2 &&

    clean(
      address.pincode
    ).length === 6
  );
}

/* ----------------------------------------
   Create Customer Order
---------------------------------------- */

export async function createCustomerOrder(
  input: CreateOrderInput
): Promise<CreatedOrder> {
  if (!input.userId) {
    throw new Error(
      "User login required."
    );
  }

  if (
    !isValidAddress(
      input.shippingAddress
    )
  ) {
    throw new Error(
      "Please enter a valid delivery address."
    );
  }

  if (
    input.paymentMethod !==
    "COD"
  ) {
    throw new Error(
      "Only Cash on Delivery is currently available."
    );
  }

  /* --------------------------------------
     Load Cart
  -------------------------------------- */

  const cart =
    await getCart(
      input.userId
    );

  if (
    !cart ||
    cart.items.length === 0
  ) {
    throw new Error(
      "Your cart is empty."
    );
  }

  /* --------------------------------------
     Load Customer
  -------------------------------------- */

  const userRef = doc(
    db,
    "users",
    input.userId
  );

  const userSnap =
    await getDoc(
      userRef
    );

  if (!userSnap.exists()) {
    throw new Error(
      "Customer profile not found."
    );
  }

  const userData =
    userSnap.data();

  /* --------------------------------------
     Prepare Order
  -------------------------------------- */

  const orderItems: OrderItem[] =
    [];

  const sellerIds: string[] =
    [];

  let subtotal = 0;

  /* --------------------------------------
     Validate Every Cart Product
  -------------------------------------- */

  for (
    const cartItem of cart.items
  ) {
    const productRef =
      doc(
        db,
        "products",
        cartItem.productId
      );

    const productSnap =
      await getDoc(
        productRef
      );

    if (
      !productSnap.exists()
    ) {
      throw new Error(
        `Product "${cartItem.name}" is no longer available.`
      );
    }

    const product =
      productSnap.data();

    /* Product status */

    if (
      product.status !==
      "active"
    ) {
      throw new Error(
        `"${product.name || cartItem.name}" is currently unavailable.`
      );
    }

    /* Seller validation */

    const productSellerId =
      clean(
        product.sellerId
      );

    if (!productSellerId) {
      throw new Error(
        `"${product.name || cartItem.name}" has an invalid seller.`
      );
    }

    if (
      productSellerId !==
      cartItem.sellerId
    ) {
      throw new Error(
        `"${product.name || cartItem.name}" seller information changed. Please refresh your cart.`
      );
    }

    /* Stock validation */

    const stock =
      Number(
        product.stock ?? 0
      );

    if (
      stock <
      cartItem.quantity
    ) {
      throw new Error(
        `"${product.name || cartItem.name}" has only ${stock} item(s) available.`
      );
    }

    /* MOQ */

    const moq =
      Math.max(
        1,
        Number(
          product.moq ?? 1
        )
      );

    if (
      cartItem.pricingType ===
        "wholesale" &&
      cartItem.quantity < moq
    ) {
      throw new Error(
        `"${product.name || cartItem.name}" requires minimum ${moq} quantity for wholesale purchase.`
      );
    }

    /* ------------------------------------
       Wholesale Tiers
    ------------------------------------ */

    const wholesaleTiers =
      Array.isArray(
        product.wholesaleTiers
      )
        ? product.wholesaleTiers
            .map(
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
            .filter(
              (tier: any) =>
                tier.minQuantity >
                  0 &&
                tier.price >= 0
            )
        : [];

    /* ------------------------------------
       Calculate Current Price
    ------------------------------------ */

    let selectedPrice: number;

    if (
      cartItem.pricingType ===
      "wholesale"
    ) {
      selectedPrice =
        getWholesalePrice(
          {
            id:
              productSnap.id,

            name:
              product.name ||
              cartItem.name,

            slug:
              product.slug ||
              cartItem.slug,

            categoryId:
              product.categoryId ||
              "",

            sellerId:
              product.sellerId,

            images:
              Array.isArray(
                product.images
              )
                ? product.images
                : [],

            mrp:
              Number(
                product.mrp ??
                  0
              ),

            retailPrice:
              Number(
                product.retailPrice ??
                  0
              ),

            wholesalePrice:
              Number(
                product.wholesalePrice ??
                  0
              ),

            moq,

            wholesaleTiers,

            stock,

            quantity:
              cartItem.quantity,

            selectedPrice:
              Number(
                product.wholesalePrice ??
                  0
              ),

            pricingType:
              "wholesale",
          },
          cartItem.quantity
        );
    } else {
      selectedPrice =
        Number(
          product.retailPrice ??
            0
        );
    }

    if (
      !Number.isFinite(
        selectedPrice
      ) ||
      selectedPrice <= 0
    ) {
      throw new Error(
        `"${product.name || cartItem.name}" has an invalid price.`
      );
    }

    /* ------------------------------------
       Item Subtotal
    ------------------------------------ */

    const itemSubtotal =
      selectedPrice *
      cartItem.quantity;

    /* ------------------------------------
       Seller Name
    ------------------------------------ */

    const sellerName =
      clean(
        product.sellerName
      ) ||
      clean(
        cartItem.sellerName
      ) ||
      "ANJIVO Seller";

    /* ------------------------------------
       Order Item
    ------------------------------------ */

    const orderItem: OrderItem =
      {
        productId:
          productSnap.id,

        sellerId:
          productSellerId,

        sellerName,

        name:
          clean(
            product.name
          ) ||
          cartItem.name,

        slug:
          clean(
            product.slug
          ) ||
          cartItem.slug,

        image:
          Array.isArray(
            product.images
          ) &&
          product.images.length >
            0
            ? product.images[0]
            : cartItem.image,

        quantity:
          cartItem.quantity,

        mrp:
          Number(
            product.mrp ??
              cartItem.mrp ??
              0
          ),

        selectedPrice,

        pricingType:
          cartItem.pricingType,

        moq,

        subtotal:
          itemSubtotal,
      };

    orderItems.push(
      orderItem
    );

    /* Seller IDs */

    if (
      !sellerIds.includes(
        productSellerId
      )
    ) {
      sellerIds.push(
        productSellerId
      );
    }

    subtotal +=
      itemSubtotal;
  }

  /* --------------------------------------
     Charges
  -------------------------------------- */

  const shippingCharge =
    0;

  const discount =
    0;

  const totalAmount =
    subtotal +
    shippingCharge -
    discount;

  if (
    orderItems.length === 0
  ) {
    throw new Error(
      "No valid products found in cart."
    );
  }

  /* --------------------------------------
     Create Order
  -------------------------------------- */

  const orderRef =
    await addDoc(
      collection(
        db,
        "orders"
      ),
      {
        userId:
          input.userId,

        customerName:
          clean(
            userData.name
          ) ||
          clean(
            userData.displayName
          ) ||
          "Customer",

        customerEmail:
          clean(
            userData.email
          ),

        sellerIds,

        items:
          orderItems,

        shippingAddress: {
          fullName:
            clean(
              input
                .shippingAddress
                .fullName
            ),

          phone:
            clean(
              input
                .shippingAddress
                .phone
            ),

          addressLine1:
            clean(
              input
                .shippingAddress
                .addressLine1
            ),

          addressLine2:
            clean(
              input
                .shippingAddress
                .addressLine2
            ),

          city:
            clean(
              input
                .shippingAddress
                .city
            ),

          state:
            clean(
              input
                .shippingAddress
                .state
            ),

          pincode:
            clean(
              input
                .shippingAddress
                .pincode
            ),
        },

        paymentMethod:
          "COD",

        paymentStatus:
          "pending",

        subtotal,

        shippingCharge,

        discount,

        totalAmount,

        status:
          "pending",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      }
    );

  return {
    orderId:
      orderRef.id,

    totalAmount,

    subtotal,

    shippingCharge,

    discount,
  };
}
