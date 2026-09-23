"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import app, { auth, db } from "@/lib/firebase";

import {
  getSellerProduct,
  updateSellerProduct,
} from "@/lib/seller-products";

import { getCategories } from "@/lib/categories";

import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

type Tier = {
  minQuantity: string;
  maxQuantity: string;
  price: string;
};

type ImageItem =
  | {
      kind: "existing";
      id: string;
      url: string;
    }
  | {
      kind: "new";
      id: string;
      file: File;
      previewUrl: string;
    };

const MAX_PRODUCT_IMAGES = 10;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

function createImageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function compressImage(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `${file.name}: only JPG, PNG, WEBP or AVIF images are allowed.`
    );
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `${file.name}: image must be 5 MB or smaller.`
    );
  }

  if (typeof window === "undefined") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / bitmap.width,
    MAX_IMAGE_DIMENSION / bitmap.height
  );

  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82)
  );

  if (!blob) {
    return file;
  }

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  return new File(
    [blob],
    `${baseName}.webp`,
    {
      type: "image/webp",
      lastModified: Date.now(),
    }
  );
}

async function tryDeleteStorageObject(url: string) {
  if (!url) return;

  try {
    await deleteObject(ref(getStorage(app), url));
  } catch {
    // Existing images may come from an external URL or may already be deleted.
    // Product data cleanup should not fail only because Storage cleanup failed.
  }
}

function createDefaultTiers(
  moq = "10"
): Tier[] {
  const numericMoq =
    Number(moq) >= 1
      ? String(Math.floor(Number(moq)))
      : "10";

  return [
    {
      minQuantity: numericMoq,
      maxQuantity: "24",
      price: "",
    },
    {
      minQuantity: "25",
      maxQuantity: "49",
      price: "",
    },
    {
      minQuantity: "50",
      maxQuantity: "99",
      price: "",
    },
    {
      minQuantity: "100",
      maxQuantity: "",
      price: "",
    },
  ];
}

export default function EditSellerProductPage() {
  const router = useRouter();
  const params = useParams();

  const productId =
    typeof params.productId === "string"
      ? params.productId
      : "";

  /* =========================================================
     STATE
  ========================================================= */

  const [product, setProduct] =
    useState<Product | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =========================================================
     FORM
  ========================================================= */

  const [name, setName] =
    useState("");

  const [slug, setSlug] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [categoryId, setCategoryId] =
    useState("");

  const [categoryName, setCategoryName] =
    useState("");

  const [mrp, setMrp] =
    useState("");

  const [retailPrice, setRetailPrice] =
    useState("");

  const [wholesalePrice, setWholesalePrice] =
    useState("");

  const [moq, setMoq] =
    useState("");

  const [stock, setStock] =
    useState("");

  const [sellingMode, setSellingMode] =
    useState<Product["sellingMode"]>("PIECE");

  const [wholesaleUnit, setWholesaleUnit] =
    useState<"PIECE" | "SET">("PIECE");

  const [setBreakAllowed, setSetBreakAllowed] =
    useState(true);

  const [wholesaleSetName, setWholesaleSetName] =
    useState("");

  const [setSize, setSetSize] =
    useState("");

  const [moqSets, setMoqSets] =
    useState("");

  const [setVariantType, setSetVariantType] =
    useState<"SIZE" | "COLOR" | "SIZE_COLOR" | "CUSTOM">("SIZE");

  const [setCompositionText, setSetCompositionText] =
    useState("");

  const [imageItems, setImageItems] =
    useState<ImageItem[]>([]);

  const [imageBusy, setImageBusy] =
    useState(false);

  const [imageError, setImageError] =
    useState("");

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const [tiers, setTiers] =
    useState<Tier[]>([]);

  /* =========================================================
     LOAD SELLER + PRODUCT
  ========================================================= */

  useEffect(() => {
    if (!productId) {
      setError("Invalid product.");
      setLoading(false);
      return;
    }

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              `/login?redirect=/seller/products/${productId}/edit`
            );
            return;
          }

          try {
            setError("");

            /* ===============================================
               USER PROFILE
            =============================================== */

            const userQuery = query(
              collection(db, "users"),
              where("uid", "==", user.uid)
            );

            const userSnapshot =
              await getDocs(userQuery);

            if (userSnapshot.empty) {
              setError(
                "Seller profile not found."
              );
              setLoading(false);
              return;
            }

            const userData =
              userSnapshot.docs[0].data();

            if (
              userData.role !== "SELLER"
            ) {
              setError(
                "Seller access required."
              );
              setLoading(false);
              return;
            }

            if (
              userData.sellerStatus !==
              "approved"
            ) {
              setError(
                "Your seller account is not approved yet."
              );
              setLoading(false);
              return;
            }

            /* ===============================================
               PRODUCT
            =============================================== */

            const loadedProduct =
              await getSellerProduct(
                user.uid,
                productId
              );

            if (!loadedProduct) {
              setError(
                "Product not found or you do not have permission to edit it."
              );
              setLoading(false);
              return;
            }

            setProduct(
              loadedProduct
            );

            /* ===============================================
               FORM VALUES
            =============================================== */

            setName(
              loadedProduct.name
            );

            setSlug(
              loadedProduct.slug
            );

            setDescription(
              loadedProduct.description ?? ""
            );

            setCategoryId(
              loadedProduct.categoryId
            );

            setCategoryName(
              loadedProduct.categoryName ??
                ""
            );

            setMrp(
              String(
                loadedProduct.mrp
              )
            );

            setRetailPrice(
              String(
                loadedProduct.retailPrice
              )
            );

            setWholesalePrice(
              String(
                loadedProduct.wholesalePrice
              )
            );

            setMoq(
              String(
                loadedProduct.moq
              )
            );

            setStock(
              String(
                loadedProduct.stock
              )
            );

            setSellingMode(
              loadedProduct.sellingMode ?? "PIECE"
            );

            const loadedConfig =
              loadedProduct.wholesaleConfiguration;

            setWholesaleUnit(
              loadedConfig?.saleUnit ?? "PIECE"
            );

            setSetBreakAllowed(
              loadedConfig?.setBreakAllowed ?? true
            );

            setWholesaleSetName(
              loadedConfig?.setName ?? ""
            );

            setSetSize(
              loadedConfig?.setSize !== undefined
                ? String(loadedConfig.setSize)
                : ""
            );

            setMoqSets(
              loadedConfig?.moqSets !== undefined
                ? String(loadedConfig.moqSets)
                : ""
            );

            setSetVariantType(
              loadedConfig?.composition?.[0]?.variantType ??
                "SIZE"
            );

            setSetCompositionText(
              loadedConfig?.composition
                ?.map((item) => {
                  const key =
                    item.size && item.color
                      ? `${item.size}/${item.color}`
                      : item.size ?? item.color ?? item.value;

                  return `${key}:${item.quantity}`;
                })
                .join(", ") ?? ""
            );

            setImageItems(
              (loadedProduct.images ?? [])
                .slice(0, MAX_PRODUCT_IMAGES)
                .map((url, index) => ({
                  kind: "existing" as const,
                  id: `existing-${index}-${url}`,
                  url,
                }))
            );

            /* ===============================================
               WHOLESALE TIERS
            =============================================== */

            if (
              loadedProduct.wholesaleTiers &&
              loadedProduct.wholesaleTiers
                .length > 0
            ) {
              setTiers(
                loadedProduct.wholesaleTiers.map(
                  (tier) => ({
                    minQuantity:
                      String(
                        tier.minQuantity
                      ),

                    maxQuantity:
                      tier.maxQuantity !==
                      undefined
                        ? String(
                            tier.maxQuantity
                          )
                        : "",

                    price:
                      String(
                        tier.price
                      ),
                  })
                )
              );
            } else {
              setTiers(
                createDefaultTiers(
                  String(
                    loadedProduct.moq
                  )
                )
              );
            }

            /* ===============================================
               CATEGORIES
            =============================================== */

            const categoryResult =
              await getCategories();

            setCategories(
              categoryResult.filter(
                (category) =>
                  category.status ===
                  "active"
              )
            );
          } catch (err) {
            console.error(
              "Edit product error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load product."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [productId, router]);

  /* =========================================================
     UPDATE TIER
  ========================================================= */

  function updateTier(
    index: number,
    field: keyof Tier,
    value: string
  ) {
    setTiers((current) =>
      current.map(
        (tier, tierIndex) =>
          tierIndex === index
            ? {
                ...tier,
                [field]: value,
              }
            : tier
      )
    );
  }

  /* =========================================================
     ADD TIER
  ========================================================= */

  function addTier() {
    setTiers((current) => [
      ...current,
      {
        minQuantity: "",
        maxQuantity: "",
        price: "",
      },
    ]);
  }

  /* =========================================================
     REMOVE TIER
  ========================================================= */

  function removeTier(
    index: number
  ) {
    setTiers((current) =>
      current.filter(
        (_, tierIndex) =>
          tierIndex !== index
      )
    );
  }

  /* =========================================================
     CATEGORY CHANGE
  ========================================================= */

  function handleCategoryChange(
    value: string
  ) {
    setCategoryId(value);

    const selected =
      categories.find(
        (category) =>
          category.id === value
      );

    setCategoryName(
      selected?.name ?? ""
    );
  }

  /* =========================================================
     SET COMPOSITION
  ========================================================= */

  function parseSetComposition() {
    const raw = setCompositionText.trim();

    if (!raw) return [];

    return raw.split(",").map((entry) => {
      const separator = entry.lastIndexOf(":");

      if (separator <= 0) {
        throw new Error(
          "Set composition format must be like S:2, M:2, L:2."
        );
      }

      const value = entry.slice(0, separator).trim();
      const quantity = Number(
        entry.slice(separator + 1).trim()
      );

      if (
        !value ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        throw new Error(
          "Each set composition item needs a valid name and quantity."
        );
      }

      const parts = value
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean);

      const size =
        setVariantType === "SIZE" ||
        setVariantType === "SIZE_COLOR"
          ? parts[0] || value
          : undefined;

      const color =
        setVariantType === "COLOR"
          ? value
          : setVariantType === "SIZE_COLOR"
            ? parts[1]
            : undefined;

      return {
        variantType: setVariantType,
        value,
        quantity,
        ...(size ? { size } : {}),
        ...(color ? { color } : {}),
      };
    });
  }


  /* =========================================================
     IMAGE MANAGEMENT
  ========================================================= */

  async function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;

    try {
      setImageError("");
      setImageBusy(true);

      const currentCount = imageItems.length;
      if (currentCount >= MAX_PRODUCT_IMAGES) {
        throw new Error(
          `Maximum ${MAX_PRODUCT_IMAGES} product images are allowed.`
        );
      }

      const remainingSlots =
        MAX_PRODUCT_IMAGES - currentCount;

      if (files.length > remainingSlots) {
        throw new Error(
          `You can add only ${remainingSlots} more image${
            remainingSlots === 1 ? "" : "s"
          }. Maximum ${MAX_PRODUCT_IMAGES} images are allowed.`
        );
      }

      const compressedFiles: ImageItem[] = [];

      for (const file of files) {
        const compressed = await compressImage(file);

        compressedFiles.push({
          kind: "new",
          id: createImageId("new-image"),
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }

      setImageItems((current) => [
        ...current,
        ...compressedFiles,
      ]);
    } catch (err) {
      setImageError(
        err instanceof Error
          ? err.message
          : "Unable to add image."
      );
    } finally {
      setImageBusy(false);
    }
  }

  function removeImage(index: number) {
    setImageError("");

    setImageItems((current) => {
      const item = current[index];

      if (item?.kind === "new") {
        URL.revokeObjectURL(item.previewUrl);
      }

      return current.filter(
        (_, itemIndex) => itemIndex !== index
      );
    });
  }

  function moveImage(
    index: number,
    direction: "left" | "right"
  ) {
    setImageError("");

    setImageItems((current) => {
      const nextIndex =
        direction === "left"
          ? index - 1
          : index + 1;

      if (
        index < 0 ||
        index >= current.length ||
        nextIndex < 0 ||
        nextIndex >= current.length
      ) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [
        next[nextIndex],
        next[index],
      ];

      return next;
    });
  }

  async function uploadNewProductImages(
    userId: string,
    items: ImageItem[]
  ): Promise<string[]> {
    const storage = getStorage(app);
    const finalUrls: string[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (item.kind === "existing") {
        finalUrls.push(item.url);
        continue;
      }

      const storagePath =
        `product-images/${userId}/${productId}/image-${Date.now()}-${index}.webp`;

      const storageRef = ref(
        storage,
        storagePath
      );

      await uploadBytes(
        storageRef,
        item.file,
        {
          contentType:
            item.file.type || "image/webp",
          cacheControl:
            "public,max-age=31536000,immutable",
        }
      );

      const url =
        await getDownloadURL(storageRef);

      finalUrls.push(url);
    }

    return finalUrls;
  }

  /* =========================================================
     SAVE PRODUCT
  ========================================================= */

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!product) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      setSaving(true);

      /* ===============================================
         BASIC
      =============================================== */

      if (!name.trim()) {
        throw new Error(
          "Product name is required."
        );
      }

      if (
        name.trim().length < 3
      ) {
        throw new Error(
          "Product name must contain at least 3 characters."
        );
      }

      if (!categoryId) {
        throw new Error(
          "Please select a category."
        );
      }

      if (!categoryName) {
        throw new Error(
          "Selected category is invalid."
        );
      }

      /* ===============================================
         SLUG
      =============================================== */

      const cleanSlug =
        slug
          .trim()
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            "");

      if (!cleanSlug) {
        throw new Error(
          "Please enter a valid product slug."
        );
      }

      /* ===============================================
         PRICE
      =============================================== */

      const mrpValue =
        Number(mrp);

      const retailValue =
        Number(retailPrice);

      const wholesaleValue =
        Number(wholesalePrice);

      if (
        !Number.isFinite(
          mrpValue
        ) ||
        mrpValue <= 0
      ) {
        throw new Error(
          "Enter a valid MRP."
        );
      }

      if (
        !Number.isFinite(
          retailValue
        ) ||
        retailValue <= 0
      ) {
        throw new Error(
          "Enter a valid retail price."
        );
      }

      if (
        !Number.isFinite(
          wholesaleValue
        ) ||
        wholesaleValue <= 0
      ) {
        throw new Error(
          "Enter a valid wholesale price."
        );
      }

      if (
        retailValue > mrpValue
      ) {
        throw new Error(
          "Retail price cannot be higher than MRP."
        );
      }

      if (
        wholesaleValue >
        retailValue
      ) {
        throw new Error(
          "Wholesale price cannot be higher than retail price."
        );
      }

      /* ===============================================
         MOQ
      =============================================== */

      const moqValue =
        Number(moq);

      if (
        !Number.isFinite(
          moqValue
        ) ||
        moqValue < 1
      ) {
        throw new Error(
          "MOQ must be at least 1."
        );
      }

      if (
        !Number.isInteger(
          moqValue
        )
      ) {
        throw new Error(
          "MOQ must be a whole number."
        );
      }

      const isSetWholesale =
        wholesaleUnit === "SET";

      const moqSetsValue = isSetWholesale
        ? Number(moqSets.trim() || moq)
        : 0;

      if (
        isSetWholesale &&
        (!Number.isInteger(moqSetsValue) ||
          moqSetsValue < 1)
      ) {
        throw new Error(
          "Set MOQ must be a whole number greater than 0."
        );
      }

      /* ===============================================
         STOCK
      =============================================== */

      const stockValue =
        Number(stock);

      if (
        stock === "" ||
        !Number.isFinite(
          stockValue
        ) ||
        stockValue < 0
      ) {
        throw new Error(
          "Enter a valid stock quantity."
        );
      }

      if (
        !Number.isInteger(
          stockValue
        )
      ) {
        throw new Error(
          "Stock must be a whole number."
        );
      }

      if (
        stockValue > 0 &&
        !isSetWholesale &&
        moqValue > stockValue
      ) {
        throw new Error(
          "MOQ cannot be greater than available stock."
        );
      }

      let wholesaleConfiguration:
        Product["wholesaleConfiguration"] =
        undefined;

      if (isSetWholesale) {
        const setSizeValue = Number(setSize);

        if (
          !Number.isInteger(setSizeValue) ||
          setSizeValue < 1
        ) {
          throw new Error(
            "Pieces per set must be a whole number greater than 0."
          );
        }

        const composition =
          parseSetComposition();

        const compositionTotal =
          composition.reduce(
            (sum, item) => sum + item.quantity,
            0
          );

        if (!composition.length) {
          throw new Error(
            "Add at least one set composition item."
          );
        }

        if (compositionTotal !== setSizeValue) {
          throw new Error(
            `Set composition total (${compositionTotal}) must match pieces per set (${setSizeValue}).`
          );
        }

        const availableSets =
          Math.floor(stockValue / setSizeValue);

        if (
          availableSets > 0 &&
          moqSetsValue > availableSets
        ) {
          throw new Error(
            "Set MOQ cannot be greater than available complete sets."
          );
        }

        wholesaleConfiguration = {
          enabled: true,
          saleUnit: "SET",
          setBreakAllowed,
          setSize: setSizeValue,
          ...(wholesaleSetName.trim()
            ? { setName: wholesaleSetName.trim() }
            : {}),
          composition,
          moqSets: moqSetsValue,
          priceUnit: "SET",
          tiers: [],
        };
      } else {
        wholesaleConfiguration = {
          enabled: true,
          saleUnit: "PIECE",
          setBreakAllowed: true,
          priceUnit: "PIECE",
          tiers: [],
        };
      }

      /* ===============================================
         WHOLESALE TIERS
      =============================================== */

      if (tiers.length === 0) {
        throw new Error(
          "Add at least one wholesale tier."
        );
      }

      const wholesaleTiers =
        tiers.map(
          (tier, index) => {
            const minQuantity =
              Number(
                tier.minQuantity
              );

            const maxQuantity =
              tier.maxQuantity.trim()
                ? Number(
                    tier.maxQuantity
                  )
                : undefined;

            const price =
              Number(tier.price);

            if (
              !tier.minQuantity.trim() ||
              !Number.isFinite(
                minQuantity
              ) ||
              minQuantity < 1
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: enter a valid minimum quantity.`
              );
            }

            if (
              !Number.isInteger(
                minQuantity
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: minimum quantity must be a whole number.`
              );
            }

            if (
              !tier.price.trim() ||
              !Number.isFinite(
                price
              ) ||
              price <= 0
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: enter a valid price.`
              );
            }

            if (
              !Number.isInteger(
                price
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: price must be a whole number.`
              );
            }

            if (
              maxQuantity !==
                undefined &&
              (
                !Number.isFinite(
                  maxQuantity
                ) ||
                maxQuantity <
                  minQuantity
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: maximum quantity cannot be smaller than minimum quantity.`
              );
            }

            if (
              maxQuantity !==
                undefined &&
              !Number.isInteger(
                maxQuantity
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: maximum quantity must be a whole number.`
              );
            }

            if (
              price >
              retailValue
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: price cannot be higher than retail price.`
              );
            }

            return {
              minQuantity,
              ...(maxQuantity !==
              undefined
                ? {
                    maxQuantity,
                  }
                : {}),
              price,
            };
          }
        );

      /* ===============================================
         SORT CHECK
      =============================================== */

      for (
        let i = 1;
        i < wholesaleTiers.length;
        i++
      ) {
        if (
          wholesaleTiers[i]
            .minQuantity <=
          wholesaleTiers[i - 1]
            .minQuantity
        ) {
          throw new Error(
            "Wholesale tiers must be in increasing quantity order."
          );
        }
      }

      /* ===============================================
         MOQ = FIRST TIER MIN
      =============================================== */

      const effectiveWholesaleMoq =
        isSetWholesale
          ? moqSetsValue
          : moqValue;

      if (
        wholesaleTiers[0]
          .minQuantity !==
        effectiveWholesaleMoq
      ) {
        throw new Error(
          `The first wholesale tier minimum quantity must match ${
            isSetWholesale ? "set MOQ" : "MOQ"
          }.`
        );
      }

      /* ===============================================
         BASE WHOLESALE = FIRST TIER PRICE
      =============================================== */

      if (
        wholesaleTiers[0].price !==
        wholesaleValue
      ) {
        throw new Error(
          "Base wholesale price must match the first wholesale tier price."
        );
      }

      /* ===============================================
         RANGE VALIDATION
      =============================================== */

      for (
        let i = 1;
        i < wholesaleTiers.length;
        i++
      ) {
        const previous =
          wholesaleTiers[i - 1];

        const current =
          wholesaleTiers[i];

        /*
         * Previous tier cannot be unlimited
         * if another tier exists.
         */

        if (
          previous.maxQuantity ===
          undefined
        ) {
          throw new Error(
            `Wholesale Tier ${
              i
            }: previous tier has no maximum quantity, so no tier can come after it.`
          );
        }

        /* ---------------------------------------------
           OVERLAP
        --------------------------------------------- */

        if (
          current.minQuantity <=
          previous.maxQuantity
        ) {
          throw new Error(
            "Wholesale quantity ranges cannot overlap."
          );
        }

        /* ---------------------------------------------
           NO GAP
        --------------------------------------------- */

        if (
          current.minQuantity !==
          previous.maxQuantity + 1
        ) {
          throw new Error(
            "Wholesale quantity ranges should be continuous without gaps."
          );
        }
      }

      /* ===============================================
         LAST TIER
      =============================================== */

      const lastTier =
        wholesaleTiers[
          wholesaleTiers.length - 1
        ];

      if (
        lastTier.maxQuantity !==
          undefined &&
        lastTier.maxQuantity <
          lastTier.minQuantity
      ) {
        throw new Error(
          "Last wholesale tier has an invalid quantity range."
        );
      }

      /* ===============================================
         IMAGE
      =============================================== */

      if (
        imageItems.length < 1
      ) {
        throw new Error(
          "Add at least one product image."
        );
      }

      if (
        imageItems.length > MAX_PRODUCT_IMAGES
      ) {
        throw new Error(
          `Maximum ${MAX_PRODUCT_IMAGES} product images are allowed.`
        );
      }

      /* ===============================================
         AUTH
      =============================================== */

      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "Your session has expired. Please login again."
        );
      }

      /* ===============================================
         UPLOAD + UPDATE
      =============================================== */

      setImageError("");
      setImageBusy(true);

      const images =
        await uploadNewProductImages(
          user.uid,
          imageItems
        );

      await updateSellerProduct(
        user.uid,
        product.id,
        {
          name: name.trim(),

          slug: cleanSlug,

          description:
            description.trim(),

          categoryId,

          categoryName,

          images,

          mrp: mrpValue,

          retailPrice:
            retailValue,

          wholesalePrice:
            wholesaleValue,

          moq: Math.floor(
            moqValue
          ),

          wholesaleTiers,

          stock: Math.floor(
            stockValue
          ),

          sellingMode,

          wholesaleConfiguration: {
            ...wholesaleConfiguration,
            tiers: wholesaleTiers,
          },
        }
      );

      const retainedExistingUrls =
        new Set(
          imageItems
            .filter(
              (item) =>
                item.kind === "existing"
            )
            .map(
              (item) => item.url
            )
        );

      const removedExistingUrls =
        (product.images ?? []).filter(
          (url) =>
            !retainedExistingUrls.has(url)
        );

      await Promise.all(
        removedExistingUrls.map(
          (url) =>
            tryDeleteStorageObject(url)
        )
      );

      setImageBusy(false);

      setImageItems((current) => {
        current.forEach((item) => {
          if (item.kind === "new") {
            URL.revokeObjectURL(
              item.previewUrl
            );
          }
        });

        return images.map(
          (url, index) => ({
            kind: "existing" as const,
            id: `saved-${index}-${url}`,
            url,
          })
        );
      });

      setSuccess(
        "Product updated successfully."
      );

      setTimeout(() => {
        router.push(
          "/seller/products"
        );
      }, 1000);
    } catch (err) {
      console.error(
        "Save product error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update product."
      );
    } finally {
      setSaving(false);
      setImageBusy(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-500">
              Loading product...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error && !product) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">

            <h1 className="text-xl font-black text-red-800">
              Unable to edit product
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

            <Link
              href="/seller/products"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              ← Back to Products
            </Link>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="mb-8">

          <Link
            href="/seller/products"
            className="text-xs font-bold text-gray-400 hover:text-black"
          >
            ← My Products
          </Link>

          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Edit Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Update your ANJIVO product information.
          </p>

        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* ===================================================
            SUCCESS
        =================================================== */}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* =================================================
              BASIC INFORMATION
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 1
            </p>

            <h2 className="mt-1 text-xl font-black">
              Basic Information
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Product title, description and category.
            </p>

            <div className="mt-6 grid gap-5">

              {/* NAME */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Product Name *
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Enter product name"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* SLUG */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Product Slug *
                </label>

                <input
                  value={slug}
                  onChange={(event) =>
                    setSlug(
                      event.target.value
                    )
                  }
                  placeholder="product-slug"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-1 text-[10px] text-gray-400">
                  Use lowercase letters, numbers and hyphens.
                </p>

              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Describe your product..."
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

              </div>

              {/* CATEGORY */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Category *
                </label>

                <select
                  value={categoryId}
                  onChange={(event) =>
                    handleCategoryChange(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >

                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.icon
                          ? `${category.icon} `
                          : ""}
                        {category.name}
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>
          </section>

          {/* =================================================
              IMAGE MANAGEMENT
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 2
            </p>

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">
                  Product Images
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Add up to {MAX_PRODUCT_IMAGES} images. The first image is the main product image.
                </p>
              </div>

              <span className="w-fit rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-black text-gray-600">
                {imageItems.length}/{MAX_PRODUCT_IMAGES}
              </span>
            </div>

            {imageError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-700">
                  {imageError}
                </p>
              </div>
            )}

            <div className="mt-5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="hidden"
                onChange={handleImageSelection}
              />

              <button
                type="button"
                disabled={
                  imageBusy ||
                  imageItems.length >=
                    MAX_PRODUCT_IMAGES
                }
                onClick={() =>
                  imageInputRef.current?.click()
                }
                className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center transition hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block text-3xl">
                  {imageBusy ? "⏳" : "📷"}
                </span>

                <span className="mt-2 block text-sm font-black text-gray-800">
                  {imageBusy
                    ? "Processing images..."
                    : imageItems.length >=
                        MAX_PRODUCT_IMAGES
                    ? "Maximum images reached"
                    : "Click to add product images"}
                </span>

                <span className="mt-1 block text-[10px] text-gray-400">
                  JPG, PNG, WEBP or AVIF • Maximum 5 MB each
                </span>
              </button>
            </div>

            {imageItems.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {imageItems.map(
                  (item, index) => {
                    const previewUrl =
                      item.kind === "existing"
                        ? item.url
                        : item.previewUrl;

                    return (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
                      >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={previewUrl}
                            alt={`${name || "Product"} image ${
                              index + 1
                            }`}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="absolute left-2 top-2">
                          <span className="rounded-full bg-black px-2 py-1 text-[9px] font-black text-white">
                            {index === 0
                              ? "MAIN"
                              : `IMAGE ${index + 1}`}
                          </span>
                        </div>

                        {item.kind === "new" && (
                          <div className="absolute right-2 top-2">
                            <span className="rounded-full bg-green-600 px-2 py-1 text-[8px] font-black text-white">
                              NEW
                            </span>
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-7">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              moveImage(
                                index,
                                "left"
                              )
                            }
                            className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-black disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Move image left"
                          >
                            ←
                          </button>

                          <button
                            type="button"
                            disabled={
                              index ===
                              imageItems.length - 1
                            }
                            onClick={() =>
                              moveImage(
                                index,
                                "right"
                              )
                            }
                            className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-black disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Move image right"
                          >
                            →
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeImage(index)
                            }
                            className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {imageItems.length === 0 && (
              <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-xs font-bold text-gray-500">
                  No product images added yet.
                </p>
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-[10px] font-semibold leading-5 text-gray-500">
                Images are compressed before upload. Use the arrow buttons to change the order; the first image becomes the main product image. Removed Firebase Storage images are cleaned up after a successful product update.
              </p>
            </div>
          </section>

          {/* =================================================
              SELLING MODE
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 3
            </p>

            <h2 className="mt-1 text-xl font-black">
              Selling Mode
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Choose how this product can be sold on ANJIVO.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {([
                ["PIECE", "Piece", "Wholesale by individual piece"],
                ["SET", "Set", "Wholesale by complete set"],
                ["BOTH", "Piece + Set", "Supports both modes"],
              ] as const).map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSellingMode(value);
                    if (value === "PIECE") {
                      setWholesaleUnit("PIECE");
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    sellingMode === value
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white hover:border-black"
                  }`}
                >
                  <p className="text-sm font-black">{label}</p>
                  <p className={`mt-1 text-[10px] leading-4 ${
                    sellingMode === value
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}>
                    {description}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <label className="text-xs font-bold text-gray-700">
                Wholesale Unit
              </label>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  ["PIECE", "Wholesale by Piece"],
                  ["SET", "Wholesale by Complete Set"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={
                      sellingMode === "PIECE" &&
                      value === "SET"
                    }
                    onClick={() =>
                      setWholesaleUnit(value)
                    }
                    className={`rounded-xl border px-4 py-3 text-left text-xs font-bold ${
                      wholesaleUnit === value
                        ? "border-black bg-white"
                        : "border-gray-200 bg-white"
                    } ${
                      sellingMode === "PIECE" &&
                      value === "SET"
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* =================================================
              PRICING
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 4
            </p>

            <h2 className="mt-1 text-xl font-black">
              Pricing
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">

              {/* MRP */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  MRP *
                </label>

                <div className="mt-2 flex items-center rounded-xl border border-gray-200">

                  <span className="px-3 text-sm font-bold text-gray-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={mrp}
                    onChange={(event) =>
                      setMrp(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl px-2 py-3 text-sm outline-none"
                  />

                </div>

              </div>

              {/* RETAIL */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Retail Price *
                </label>

                <div className="mt-2 flex items-center rounded-xl border border-gray-200">

                  <span className="px-3 text-sm font-bold text-gray-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={retailPrice}
                    onChange={(event) =>
                      setRetailPrice(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl px-2 py-3 text-sm outline-none"
                  />

                </div>

              </div>

              {/* WHOLESALE */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Base Wholesale Price *
                </label>

                <div className="mt-2 flex items-center rounded-xl border border-gray-200">

                  <span className="px-3 text-sm font-bold text-gray-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={wholesalePrice}
                    onChange={(event) =>
                      setWholesalePrice(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl px-2 py-3 text-sm outline-none"
                  />

                </div>

              </div>

            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] font-semibold leading-5 text-gray-500">
                Base Wholesale Price must match
                the first wholesale tier price.
              </p>
            </div>

          </section>

          {/* =================================================
              WHOLESALE SET CONFIGURATION
          ================================================= */}

          {wholesaleUnit === "SET" && (
            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Step 5
              </p>

              <h2 className="mt-1 text-xl font-black">
                Wholesale Set Configuration
              </h2>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Configure the complete set and its composition.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Set Name
                  </label>
                  <input
                    value={wholesaleSetName}
                    onChange={(event) =>
                      setWholesaleSetName(event.target.value)
                    }
                    placeholder="e.g. Full Size Set"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Pieces Per Set *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={setSize}
                    onChange={(event) =>
                      setSetSize(event.target.value)
                    }
                    placeholder="e.g. 6"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Set MOQ *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={moqSets}
                    onChange={(event) =>
                      setMoqSets(event.target.value)
                    }
                    placeholder="e.g. 2"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700">
                    Composition Type
                  </label>
                  <select
                    value={setVariantType}
                    onChange={(event) =>
                      setSetVariantType(
                        event.target.value as
                          | "SIZE"
                          | "COLOR"
                          | "SIZE_COLOR"
                          | "CUSTOM"
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  >
                    <option value="SIZE">Size</option>
                    <option value="COLOR">Color</option>
                    <option value="SIZE_COLOR">
                      Size + Color
                    </option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-xs font-bold text-gray-700">
                  Set Composition *
                </label>

                <input
                  value={setCompositionText}
                  onChange={(event) =>
                    setSetCompositionText(
                      event.target.value
                    )
                  }
                  placeholder="S:2, M:2, L:2"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-2 text-[10px] leading-5 text-gray-400">
                  Use name:quantity format. For Size + Color,
                  use size/color:quantity. The total must equal
                  Pieces Per Set.
                </p>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <input
                  type="checkbox"
                  checked={!setBreakAllowed}
                  onChange={(event) =>
                    setSetBreakAllowed(
                      !event.target.checked
                    )
                  }
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block text-xs font-black">
                    Lock complete set
                  </span>
                  <span className="mt-1 block text-[10px] leading-5 text-gray-500">
                    Buyers must purchase the complete configured set.
                  </span>
                </span>
              </label>
            </section>
          )}

          {/* =================================================
              WHOLESALE TIERS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Step 6
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Wholesale Pricing
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Set quantity-based prices for bulk buyers.
                </p>

              </div>

              <button
                type="button"
                onClick={addTier}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
              >
                + Add Tier
              </button>

            </div>

            <div className="mt-6 space-y-3">

              {tiers.map(
                (tier, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >

                    <div className="mb-3 flex items-center justify-between">

                      <p className="text-xs font-black">
                        Tier {index + 1}
                      </p>

                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeTier(
                              index
                            )
                          }
                          className="text-[10px] font-bold text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}

                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">

                      {/* MIN */}

                      <div>

                        <label className="text-[10px] font-bold text-gray-500">
                          Minimum Qty
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            tier.minQuantity
                          }
                          onChange={(event) =>
                            updateTier(
                              index,
                              "minQuantity",
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                        />

                      </div>

                      {/* MAX */}

                      <div>

                        <label className="text-[10px] font-bold text-gray-500">
                          Maximum Qty
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            tier.maxQuantity
                          }
                          onChange={(event) =>
                            updateTier(
                              index,
                              "maxQuantity",
                              event.target.value
                            )
                          }
                          placeholder="No limit"
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                        />

                      </div>

                      {/* PRICE */}

                      <div>

                        <label className="text-[10px] font-bold text-gray-500">
                          Price / Piece
                        </label>

                        <div className="mt-1 flex items-center rounded-xl border border-gray-200 bg-white">

                          <span className="px-3 text-xs font-bold text-gray-400">
                            ₹
                          </span>

                          <input
                            type="number"
                            min="0"
                            value={
                              tier.price
                            }
                            onChange={(event) =>
                              updateTier(
                                index,
                                "price",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl px-1 py-2.5 text-sm outline-none"
                          />

                        </div>

                      </div>

                    </div>

                    {index === 0 && (
                      <p className="mt-3 text-[10px] font-semibold text-gray-400">
                        First tier minimum quantity must match MOQ.
                      </p>
                    )}

                    {index ===
                      tiers.length - 1 && (
                      <p className="mt-3 text-[10px] font-semibold text-gray-400">
                        Leave maximum quantity empty for unlimited quantity.
                      </p>
                    )}

                  </div>
                )
              )}

            </div>
          </section>

          {/* =================================================
              INVENTORY
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 7
            </p>

            <h2 className="mt-1 text-xl font-black">
              MOQ & Inventory
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* MOQ */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Minimum Order Quantity (MOQ) *
                </label>

                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(event) =>
                    setMoq(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Wholesale buyers must purchase at least this quantity.
                </p>

              </div>

              {/* STOCK */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Available Stock *
                </label>

                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(event) =>
                    setStock(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Total quantity currently available for sale.
                </p>

              </div>

            </div>
          </section>

          {/* =================================================
              CURRENT STATUS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Marketplace
            </p>

            <h2 className="mt-1 text-xl font-black">
              Product Status
            </h2>

            <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-xs font-bold text-gray-400">
                  Current Status
                </p>

                <p className="mt-1 text-sm font-black uppercase">
                  {product.status.replace(
                    "_",
                    " "
                  )}
                </p>

              </div>

              <span
                className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${
                  product.status ===
                  "active"
                    ? "bg-green-100 text-green-700"
                    : product.status ===
                        "blocked"
                    ? "bg-red-100 text-red-700"
                    : product.status ===
                        "out_of_stock"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {product.status.replace(
                  "_",
                  " "
                )}
              </span>

            </div>

            <p className="mt-3 text-[11px] leading-5 text-gray-400">
              Product status, featured placement,
              best-seller designation and trending
              placement are controlled by ANJIVO
              marketplace administration.
            </p>

          </section>

          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">

            <Link
              href="/seller/products"
              className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold text-gray-700 hover:border-black hover:text-black"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        </form>
      </main>

      <Footer />
    </div>
  );
}
