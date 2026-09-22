import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/firebase-admin-auth";

type PricingType = "retail" | "wholesale";
type WholesaleUnit = "PIECE" | "SET";

type CheckoutItemInput = {
  id?: string;
  productId?: string;
  sellerId?: string;
  quantity?: number;
  pricingType?: PricingType;

  wholesaleUnit?: WholesaleUnit;
  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;
};

type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

type SetCompositionItem = {
  variantType?: string;
  value?: string;
  quantity?: number;
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

type ProductRecord = {
  id: string;
  name?: string;
  slug?: string;

  sellerId?: string;
  sellerName?: string;

  status?: string;

  stock?: number;

  mrp?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  moq?: number;

  wholesaleTiers?: WholesaleTier[];

  sellingMode?: "PIECE" | "SET" | "BOTH";

  wholesaleConfiguration?: WholesaleConfiguration;
};

type ValidatedItem = {
  productId: string;
  sellerId: string;

  name: string;
  slug: string;

  quantity: number;

  pricingType: PricingType;

  unitPrice: number;
  lineTotal: number;

  retailPrice: number;
  mrp: number;

  stock: number;

  wholesaleUnit?: WholesaleUnit;

  piecesPerSet?: number;
  setName?: string;
  setBreakAllowed?: boolean;

  setComposition?: SetCompositionItem[];

  wholesaleMoq?: number;

  priceUnit?: WholesaleUnit;

  wholesaleTier?: {
    minQuantity: number;
    maxQuantity?: number;
    price: number;
  };
};

function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    { status: 400 }
  );
}

function unauthorized(message = "Authentication required.") {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status: 401 }
  );
}

function serverError(message = "Checkout validation failed.") {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status: 500 }
  );
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isValidPricingType(
  value: unknown
): value is PricingType {
  return value === "retail" || value === "wholesale";
}

function isValidWholesaleUnit(
  value: unknown
): value is WholesaleUnit {
  return value === "PIECE" || value === "SET";
}

function normalizeNumber(
  value: unknown,
  fallback = 0
): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return numberValue;
}

function normalizeTier(
  tier: WholesaleTier
): WholesaleTier | null {
  const minQuantity = Number(tier?.minQuantity);
  const maxQuantity =
    tier?.maxQuantity === undefined ||
    tier?.maxQuantity === null
      ? undefined
      : Number(tier.maxQuantity);
  const price = Number(tier?.price);

  if (
    !Number.isInteger(minQuantity) ||
    minQuantity <= 0 ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }

  if (
    maxQuantity !== undefined &&
    (!Number.isInteger(maxQuantity) ||
      maxQuantity < minQuantity)
  ) {
    return null;
  }

  return {
    minQuantity,
    ...(maxQuantity !== undefined
      ? { maxQuantity }
      : {}),
    price,
  };
}

function normalizeTiers(
  tiers: unknown
): WholesaleTier[] {
  if (!Array.isArray(tiers)) {
    return [];
  }

  return tiers
    .map((tier) =>
      normalizeTier(
        tier as WholesaleTier
      )
    )
    .filter(
      (tier): tier is WholesaleTier =>
        tier !== null
    )
    .sort(
      (a, b) =>
        a.minQuantity - b.minQuantity
    );
}

function getTierForQuantity(
  tiers: WholesaleTier[],
  quantity: number
): WholesaleTier | null {
  let selected: WholesaleTier | null = null;

  for (const tier of tiers) {
    if (quantity < tier.minQuantity) {
      continue;
    }

    if (
      tier.maxQuantity !== undefined &&
      quantity > tier.maxQuantity
    ) {
      continue;
    }

    selected = tier;
  }

  return selected;
}

function normalizeComposition(
  composition: unknown
): SetCompositionItem[] {
  if (!Array.isArray(composition)) {
    return [];
  }

  return composition
    .map((item): SetCompositionItem | null => {
      const source =
        item as SetCompositionItem;

      const quantity = Number(
        source.quantity
      );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return null;
      }

      return {
        ...(source.variantType
          ? {
              variantType:
                String(source.variantType),
            }
          : {}),
        ...(source.value
          ? {
              value:
                String(source.value),
            }
          : {}),
        quantity,
        ...(source.size
          ? {
              size:
                String(source.size),
            }
          : {}),
        ...(source.color
          ? {
              color:
                String(source.color),
            }
          : {}),
      };
    })
    .filter(
      (item): item is SetCompositionItem =>
        item !== null
    );
}

function getCompositionSize(
  composition: SetCompositionItem[]
): number {
  return composition.reduce(
    (total, item) =>
      total +
      normalizeNumber(
        item.quantity,
        0
      ),
    0
  );
}

function isSetProduct(
  product: ProductRecord
): boolean {
  const config =
    product.wholesaleConfiguration;

  return (
    config?.saleUnit === "SET" &&
    Number(config.setSize) > 0
  );
}

function getWholesaleConfiguration(
  product: ProductRecord
): WholesaleConfiguration | null {
  if (
    !product.wholesaleConfiguration ||
    product.wholesaleConfiguration
      .enabled === false
  ) {
    return null;
  }

  return product.wholesaleConfiguration;
}

function validateSetConfiguration(
  product: ProductRecord
): {
  valid: boolean;
  message?: string;
  config?: WholesaleConfiguration;
  composition?: SetCompositionItem[];
  setSize?: number;
} {
  const config =
    getWholesaleConfiguration(product);

  if (!config) {
    return {
      valid: false,
      message:
        "Wholesale configuration is missing.",
    };
  }

  if (config.saleUnit !== "SET") {
    return {
      valid: false,
      message:
        "This product is not configured for set wholesale.",
    };
  }

  const setSize = Number(
    config.setSize
  );

  if (
    !Number.isInteger(setSize) ||
    setSize <= 0
  ) {
    return {
      valid: false,
      message:
        "Invalid set size configured for this product.",
    };
  }

  const composition =
    normalizeComposition(
      config.composition
    );

  if (composition.length === 0) {
    return {
      valid: false,
      message:
        "Set composition is missing.",
    };
  }

  const compositionSize =
    getCompositionSize(
      composition
    );

  if (compositionSize !== setSize) {
    return {
      valid: false,
      message:
        "Set composition does not match the configured set size.",
    };
  }

  return {
    valid: true,
    config,
    composition,
    setSize,
  };
}

function calculateAvailableSets(
  product: ProductRecord,
  setSize: number,
  composition: SetCompositionItem[]
): number {
  /*
   * Current Product schema stores product-level stock.
   *
   * Until variant/component-level inventory is introduced,
   * the safest server-side calculation is based on total
   * piece stock and the configured pieces-per-set.
   */
  const stock = Math.max(
    0,
    Math.floor(
      normalizeNumber(
        product.stock,
        0
      )
    )
  );

  if (setSize <= 0) {
    return 0;
  }

  /*
   * Composition is deliberately consumed here so that
   * malformed/empty composition cannot silently bypass
   * set validation.
   */
  const compositionSize =
    getCompositionSize(
      composition
    );

  if (compositionSize !== setSize) {
    return 0;
  }

  return Math.floor(
    stock / setSize
  );
}

async function getUserRecord(
  uid: string
) {
  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() || null;
}

function isWholesaleCustomer(
  userData: Record<string, unknown> | null
): boolean {
  if (!userData) {
    return false;
  }

  return (
    userData.role ===
      "WHOLESALE_CUSTOMER" ||
    userData.customerType ===
      "WHOLESALE_CUSTOMER"
  );
}

function isActiveCustomer(
  userData: Record<string, unknown> | null
): boolean {
  if (!userData) {
    return false;
  }

  const accountStatus =
    userData.accountStatus;

  /*
   * Existing accounts may not have accountStatus
   * while older records are being migrated.
   */
  if (!accountStatus) {
    return true;
  }

  return (
    accountStatus === "ACTIVE"
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. VERIFY AUTHENTICATION
     * ---------------------------------------------------------
     *
     * UID comes ONLY from the verified Firebase ID token.
     * Client cannot choose the user ID.
     */
    let decodedToken;

    try {
      decodedToken =
        await verifyIdToken(
          request.headers.get(
            "authorization"
          )
        );
    } catch {
      return unauthorized();
    }

    const uid = decodedToken.uid;

    if (!uid) {
      return unauthorized(
        "Invalid authentication token."
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. LOAD USER
     * ---------------------------------------------------------
     */
    const userData =
      await getUserRecord(uid);

    if (!userData) {
      return unauthorized(
        "User account was not found."
      );
    }

    if (
      !isActiveCustomer(
        userData
      )
    ) {
      return badRequest(
        "Your account is not active yet."
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. READ REQUEST BODY
     * ---------------------------------------------------------
     */
    const body =
      await request.json();

    const rawItems =
      body?.items;

    if (
      !Array.isArray(rawItems) ||
      rawItems.length === 0
    ) {
      return badRequest(
        "Cart is empty."
      );
    }

    if (rawItems.length > 100) {
      return badRequest(
        "Too many cart items."
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. NORMALIZE INPUT
     * ---------------------------------------------------------
     */
    const items: CheckoutItemInput[] =
      rawItems.map(
        (item: unknown) => {
          const source =
            item as CheckoutItemInput;

          return {
            id:
              typeof source.id ===
              "string"
                ? source.id.trim()
                : undefined,

            productId:
              typeof source.productId ===
              "string"
                ? source.productId.trim()
                : undefined,

            sellerId:
              typeof source.sellerId ===
              "string"
                ? source.sellerId.trim()
                : undefined,

            quantity:
              Number(
                source.quantity
              ),

            pricingType:
              source.pricingType,

            wholesaleUnit:
              source.wholesaleUnit,

            piecesPerSet:
              source.piecesPerSet !==
              undefined
                ? Number(
                    source.piecesPerSet
                  )
                : undefined,

            setName:
              typeof source.setName ===
              "string"
                ? source.setName.trim()
                : undefined,

            setBreakAllowed:
              source.setBreakAllowed,
          };
        }
      );

    /*
     * ---------------------------------------------------------
     * 5. BASIC ITEM VALIDATION
     * ---------------------------------------------------------
     */
    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item =
        items[index];

      const productId =
        item.productId ||
        item.id;

      if (!productId) {
        return badRequest(
          `Product ID missing for cart item ${index + 1}.`
        );
      }

      if (
        !item.sellerId
      ) {
        return badRequest(
          `Seller ID missing for cart item ${index + 1}.`
        );
      }

      if (
        !isPositiveInteger(
          item.quantity
        )
      ) {
        return badRequest(
          `Invalid quantity for cart item ${index + 1}.`
        );
      }

      if (
        !isValidPricingType(
          item.pricingType
        )
      ) {
        return badRequest(
          `Invalid pricing type for cart item ${index + 1}.`
        );
      }

      item.productId =
        productId;
    }

    /*
     * ---------------------------------------------------------
     * 6. PREVENT DUPLICATE LINES
     * ---------------------------------------------------------
     *
     * Same product can legitimately appear as:
     * retail + wholesale.
     *
     * But the same exact pricing configuration should not
     * appear multiple times.
     */
    const duplicateKeys =
      new Set<string>();

    for (const item of items) {
      const key = [
        item.productId,
        item.sellerId,
        item.pricingType,
        item.wholesaleUnit ||
          "NONE",
        item.piecesPerSet ||
          0,
        item.setName ||
          "",
      ].join("|");

      if (
        duplicateKeys.has(key)
      ) {
        return badRequest(
          "Duplicate cart line detected. Please refresh your cart and try again."
        );
      }

      duplicateKeys.add(key);
    }

    /*
     * ---------------------------------------------------------
     * 7. LOAD PRODUCTS
     * ---------------------------------------------------------
     */
    const productIds = Array.from(
      new Set(
        items.map(
          (item) =>
            item.productId as string
        )
      )
    );

    const productRefs =
      productIds.map(
        (productId) =>
          adminDb
            .collection("products")
            .doc(productId)
      );

    const productSnapshots =
      await adminDb.getAll(
        ...productRefs
      );

    const products =
      new Map<
        string,
        ProductRecord
      >();

    for (
      let index = 0;
      index <
      productSnapshots.length;
      index++
    ) {
      const snapshot =
        productSnapshots[index];

      if (!snapshot.exists) {
        continue;
      }

      products.set(
        productIds[index],
        {
          id: snapshot.id,
          ...(snapshot.data() as Omit<
            ProductRecord,
            "id"
          >),
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. WHOLESALE CUSTOMER CHECK
     * ---------------------------------------------------------
     */
    const containsWholesale =
      items.some(
        (item) =>
          item.pricingType ===
          "wholesale"
      );

    if (
      containsWholesale &&
      !isWholesaleCustomer(
        userData
      )
    ) {
      return badRequest(
        "Wholesale pricing is available only for approved wholesale customers."
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. AGGREGATE PIECE REQUIREMENTS
     * ---------------------------------------------------------
     *
     * We calculate total required stock per product.
     *
     * This prevents a user from bypassing stock limits by
     * splitting the same product into multiple cart lines.
     */
    const requiredPiecesByProduct =
      new Map<
        string,
        number
      >();

    const requiredSetsByProduct =
      new Map<
        string,
        number
      >();

    /*
     * ---------------------------------------------------------
     * 10. VALIDATE EACH ITEM
     * ---------------------------------------------------------
     */
    const validatedItems: ValidatedItem[] =
      [];

    for (const item of items) {
      const product =
        products.get(
          item.productId as string
        );

      if (!product) {
        return badRequest(
          `Product not found: ${item.productId}`
        );
      }

      /*
       * Seller ownership is always taken from
       * Firestore product data.
       */
      if (
        product.sellerId !==
        item.sellerId
      ) {
        return badRequest(
          `Seller does not own product: ${product.name || item.productId}`
        );
      }

      /*
       * Only active products can be purchased.
       */
      if (
        product.status !==
        "active"
      ) {
        return badRequest(
          `Product is not available: ${product.name || item.productId}`
        );
      }

      const productStock =
        Math.max(
          0,
          Math.floor(
            normalizeNumber(
              product.stock,
              0
            )
          )
        );

      /*
       * -------------------------------------------------------
       * RETAIL
       * -------------------------------------------------------
       */
      if (
        item.pricingType ===
        "retail"
      ) {
        const sellingMode =
          product.sellingMode;

        if (
          sellingMode ===
          "SET"
        ) {
          return badRequest(
            `Retail piece purchase is not available for ${product.name || item.productId}.`
          );
        }

        const retailPrice =
          normalizeNumber(
            product.retailPrice,
            0
          );

        if (
          retailPrice <= 0
        ) {
          return badRequest(
            `Retail price is not configured for ${product.name || item.productId}.`
          );
        }

        const existingPieces =
          requiredPiecesByProduct.get(
            product.id
          ) || 0;

        requiredPiecesByProduct.set(
          product.id,
          existingPieces +
            item.quantity
        );

        validatedItems.push({
          productId:
            product.id,

          sellerId:
            product.sellerId as string,

          name:
            product.name || "",

          slug:
            product.slug || "",

          quantity:
            item.quantity,

          pricingType:
            "retail",

          unitPrice:
            retailPrice,

          lineTotal:
            retailPrice *
            item.quantity,

          retailPrice,

          mrp:
            normalizeNumber(
              product.mrp,
              retailPrice
            ),

          stock:
            productStock,
        });

        continue;
      }

      /*
       * -------------------------------------------------------
       * WHOLESALE
       * -------------------------------------------------------
       */
      const config =
        getWholesaleConfiguration(
          product
        );

      if (!config) {
        return badRequest(
          `Wholesale buying is not configured for ${product.name || item.productId}.`
        );
      }

      const configuredUnit =
        config.saleUnit;

      if (
        !isValidWholesaleUnit(
          configuredUnit
        )
      ) {
        return badRequest(
          `Invalid wholesale unit configuration for ${product.name || item.productId}.`
        );
      }

      /*
       * Client-provided wholesale unit must match
       * the server configuration.
       */
      if (
        item.wholesaleUnit &&
        item.wholesaleUnit !==
          configuredUnit
      ) {
        return badRequest(
          `Wholesale unit mismatch for ${product.name || item.productId}.`
        );
      }

      /*
       * -------------------------------------------------------
       * WHOLESALE PIECE
       * -------------------------------------------------------
       */
      if (
        configuredUnit ===
        "PIECE"
      ) {
        const tiers =
          normalizeTiers(
            config.tiers &&
              config.tiers.length > 0
              ? config.tiers
              : product.wholesaleTiers
          );

        if (
          tiers.length === 0
        ) {
          return badRequest(
            `Wholesale pricing tiers are not configured for ${product.name || item.productId}.`
          );
        }

        const moq =
          Math.max(
            1,
            Math.floor(
              normalizeNumber(
                product.moq,
                1
              )
            )
          );

        if (
          item.quantity <
          moq
        ) {
          return badRequest(
            `Minimum wholesale quantity for ${product.name || item.productId} is ${moq} pieces.`
          );
        }

        const tier =
          getTierForQuantity(
            tiers,
            item.quantity
          );

        if (!tier) {
          return badRequest(
            `No wholesale price tier is available for ${product.name || item.productId} at ${item.quantity} pieces.`
          );
        }

        const existingPieces =
          requiredPiecesByProduct.get(
            product.id
          ) || 0;

        requiredPiecesByProduct.set(
          product.id,
          existingPieces +
            item.quantity
        );

        validatedItems.push({
          productId:
            product.id,

          sellerId:
            product.sellerId as string,

          name:
            product.name || "",

          slug:
            product.slug || "",

          quantity:
            item.quantity,

          pricingType:
            "wholesale",

          unitPrice:
            tier.price,

          lineTotal:
            tier.price *
            item.quantity,

          retailPrice:
            normalizeNumber(
              product.retailPrice,
              0
            ),

          mrp:
            normalizeNumber(
              product.mrp,
              product.retailPrice ||
                0
            ),

          stock:
            productStock,

          wholesaleUnit:
            "PIECE",

          wholesaleMoq:
            moq,

          priceUnit:
            "PIECE",

          wholesaleTier:
            tier,
        });

        continue;
      }

      /*
       * -------------------------------------------------------
       * WHOLESALE SET / PACK
       * -------------------------------------------------------
       */
      const setValidation =
        validateSetConfiguration(
          product
        );

      if (
        !setValidation.valid ||
        !setValidation.config ||
        !setValidation.composition ||
        !setValidation.setSize
      ) {
        return badRequest(
          setValidation.message ||
            `Invalid set configuration for ${product.name || item.productId}.`
        );
      }

      const setSize =
        setValidation.setSize;

      const composition =
        setValidation.composition;

      const moqSets =
        Math.max(
          1,
          Math.floor(
            normalizeNumber(
              setValidation.config
                .moqSets,
              1
            )
          )
        );

      if (
        item.quantity <
        moqSets
      ) {
        return badRequest(
          `Minimum wholesale quantity for ${product.name || item.productId} is ${moqSets} sets.`
        );
      }

      /*
       * Client must represent the same set size.
       */
      if (
        item.piecesPerSet !==
          undefined &&
        Number(
          item.piecesPerSet
        ) !== setSize
      ) {
        return badRequest(
          `Set size mismatch for ${product.name || item.productId}.`
        );
      }

      /*
       * Server owns the set name.
       */
      const serverSetName =
        String(
          setValidation.config
            .setName || ""
        ).trim();

      /*
       * If a set name exists on the server,
       * the client value cannot override it.
       */
      if (
        item.setName &&
        serverSetName &&
        item.setName !==
          serverSetName
      ) {
        return badRequest(
          `Set configuration mismatch for ${product.name || item.productId}.`
        );
      }

      /*
       * Set break rule is always server-controlled.
       */
      const serverSetBreakAllowed =
        setValidation.config
          .setBreakAllowed ===
        true;

      if (
        item.setBreakAllowed !==
          undefined &&
        item.setBreakAllowed !==
          serverSetBreakAllowed
      ) {
        return badRequest(
          `Set break configuration mismatch for ${product.name || item.productId}.`
        );
      }

      /*
       * IMPORTANT:
       * quantity = NUMBER OF SETS
       *
       * Example:
       * 2 sets × 6 pieces = 12 pieces.
       */
      const requiredPieces =
        item.quantity *
        setSize;

      const availableSets =
        calculateAvailableSets(
          product,
          setSize,
          composition
        );

      if (
        item.quantity >
        availableSets
      ) {
        return badRequest(
          `Only ${availableSets} sets are currently available for ${product.name || item.productId}.`
        );
      }

      /*
       * Aggregate both piece and set requirements.
       */
      const existingPieces =
        requiredPiecesByProduct.get(
          product.id
        ) || 0;

      requiredPiecesByProduct.set(
        product.id,
        existingPieces +
          requiredPieces
      );

      const existingSets =
        requiredSetsByProduct.get(
          product.id
        ) || 0;

      requiredSetsByProduct.set(
        product.id,
        existingSets +
          item.quantity
      );

      /*
       * Set wholesale tiers use SET quantity.
       */
      const tiers =
        normalizeTiers(
          setValidation.config
            .tiers
        );

      if (
        tiers.length === 0
      ) {
        return badRequest(
          `Wholesale set pricing tiers are not configured for ${product.name || item.productId}.`
        );
      }

      const tier =
        getTierForQuantity(
          tiers,
          item.quantity
        );

      if (!tier) {
        return badRequest(
          `No wholesale set price tier is available for ${product.name || item.productId} at ${item.quantity} sets.`
        );
      }

      /*
       * Price is PER SET.
       */
      const lineTotal =
        tier.price *
        item.quantity;

      validatedItems.push({
        productId:
          product.id,

        sellerId:
          product.sellerId as string,

        name:
          product.name || "",

        slug:
          product.slug || "",

        quantity:
          item.quantity,

        pricingType:
          "wholesale",

        unitPrice:
          tier.price,

        lineTotal,

        retailPrice:
          normalizeNumber(
            product.retailPrice,
            0
          ),

        mrp:
          normalizeNumber(
            product.mrp,
            0
          ),

        stock:
          productStock,

        wholesaleUnit:
          "SET",

        piecesPerSet:
          setSize,

        setName:
          serverSetName ||
          undefined,

        setBreakAllowed:
          serverSetBreakAllowed,

        setComposition:
          composition,

        wholesaleMoq:
          moqSets,

        priceUnit:
          "SET",

        wholesaleTier:
          tier,
      });
    }

    /*
     * ---------------------------------------------------------
     * 11. FINAL AGGREGATED STOCK VALIDATION
     * ---------------------------------------------------------
     *
     * This happens AFTER all lines have been processed.
     *
     * Example:
     * Retail: 5 pieces
     * Wholesale: 10 pieces
     * Total required: 15
     *
     * The same product cannot consume 5 + 10 if stock is only 12.
     */
    for (
      const [
        productId,
        requiredPieces,
      ] of requiredPiecesByProduct
    ) {
      const product =
        products.get(
          productId
        );

      if (!product) {
        return badRequest(
          "A product in the cart no longer exists."
        );
      }

      const availablePieces =
        Math.max(
          0,
          Math.floor(
            normalizeNumber(
              product.stock,
              0
            )
          )
        );

      if (
        requiredPieces >
        availablePieces
      ) {
        return badRequest(
          `Insufficient stock for ${product.name || productId}. Available: ${availablePieces} pieces, required: ${requiredPieces} pieces.`
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 12. TOTALS
     * ---------------------------------------------------------
     */
    const subtotal =
      validatedItems.reduce(
        (
          total,
          item
        ) =>
          total +
          item.lineTotal,
        0
      );

    const totalPieces =
      validatedItems.reduce(
        (
          total,
          item
        ) => {
          if (
            item.pricingType ===
              "wholesale" &&
            item.wholesaleUnit ===
              "SET"
          ) {
            return (
              total +
              item.quantity *
                (item.piecesPerSet ||
                  0)
            );
          }

          return (
            total +
            item.quantity
          );
        },
        0
      );

    const sellerIds =
      Array.from(
        new Set(
          validatedItems.map(
            (item) =>
              item.sellerId
          )
        )
      );

    /*
     * ---------------------------------------------------------
     * 13. RESPONSE
     * ---------------------------------------------------------
     *
     * Client receives server-calculated prices and snapshots.
     * Client price is NEVER trusted.
     */
    return NextResponse.json({
      success: true,

      userId: uid,

      items:
        validatedItems,

      totals: {
        subtotal,
        shipping: 0,
        discount: 0,
        tax: 0,
        grandTotal: subtotal,
        totalPieces,
        itemCount:
          validatedItems.length,
        sellerCount:
          sellerIds.length,
      },

      sellers:
        sellerIds.map(
          (sellerId) => ({
            sellerId,
            itemCount:
              validatedItems.filter(
                (item) =>
                  item.sellerId ===
                  sellerId
              ).length,
            subtotal:
              validatedItems
                .filter(
                  (item) =>
                    item.sellerId ===
                    sellerId
                )
                .reduce(
                  (
                    total,
                    item
                  ) =>
                    total +
                    item.lineTotal,
                  0
                ),
          })
        ),

      validatedAt:
        new Date().toISOString(),

      message:
        "Checkout validated successfully.",
    });
  } catch (error) {
    console.error(
      "Checkout validation error:",
      error
    );

    return serverError();
  }
}
