
import OpenAI from "openai";

import type {
  AIProductListing,
  AIProductVariant,
  AIListingGenerateRequest,
  AIProductImage,
} from "@/lib/ai/listing-types";

// Server-side only. Never import this file into a client component.
const apiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey,
});

interface GeneratedProductData {
  title: string;
  description: string;
  shortDescription: string;
  brand: string;
  category: string;
  subcategory: string;
  productType: string;
  highlights: string[];
  searchKeywords: string[];
  attributes: Record<string, string>;
  colors: string[];
  sizes: string[];
  warnings: string[];
}

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createId(): string {
  return crypto.randomUUID();
}

function createVariant(
  color: string,
  size: string,
  index: number
): AIProductVariant {
  const safeColor = color || "Default";
  const safeSize = size || "OneSize";

  return {
    id: createId(),

    // Temporary SKU. Seller must verify before publishing.
    sku: `ANJ-${index + 1}-${safeColor
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()}-${safeSize.toUpperCase()}`,

    color: color || undefined,
    size: size || undefined,

    attributes: {
      ...(color ? { Color: color } : {}),
      ...(size ? { Size: size } : {}),
    },

    imageUrls: [],

    stockQuantity: null,
    sellingPrice: null,
    wholesalePrice: null,
    mrp: null,

    isConfirmed: false,
  };
}

function buildVariants(
  colors: string[],
  sizes: string[]
): AIProductVariant[] {
  const finalColors = colors.length > 0 ? colors : [""];
  const finalSizes = sizes.length > 0 ? sizes : [""];

  const variants: AIProductVariant[] = [];

  for (const color of finalColors) {
    for (const size of finalSizes) {
      variants.push(
        createVariant(color, size, variants.length)
      );
    }
  }

  return variants;
}

function buildImageGallery(
  urls: string[]
): AIProductImage[] {
  const views = [
    "front",
    "back",
    "left",
    "right",
    "detail",
    "lifestyle",
  ] as const;

  return urls.map((url, index) => ({
    id: createId(),
    url,
    view: views[index] ?? "detail",
    source: "original",
    altText: `Product image ${index + 1}`,
    reviewStatus: "pending",
    isPrimary: index === 0,
    isAIGenerated: false,
  }));
}

function extractJson(text: string): GeneratedProductData {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const data = JSON.parse(cleaned);

  if (
    typeof data.title !== "string" ||
    typeof data.description !== "string" ||
    typeof data.category !== "string"
  ) {
    throw new Error("AI returned incomplete product details.");
  }

  return data as GeneratedProductData;
}

export async function generateAIListing(
  request: AIListingGenerateRequest
): Promise<AIProductListing> {
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing from server environment."
    );
  }

  if (!request.images || request.images.length === 0) {
    throw new Error("At least one product image is required.");
  }

  if (request.images.length > 10) {
    throw new Error("Maximum 10 images allowed per listing.");
  }

  const imageInputs = request.images.map((url) => ({
    type: "image_url" as const,
    image_url: {
      url,
      detail: "high" as const,
    },
  }));

  const prompt = `
You are the ANJIVO ecommerce product catalog assistant.

Analyze the uploaded product images and generate an accurate
ecommerce product listing.

User hints:
Category: ${request.categoryHint || "Not provided"}
Brand: ${request.brandHint || "Not provided"}
Product: ${request.productHint || "Not provided"}

Variant hints:
Sizes: ${request.variantHints?.sizes?.join(", ") || "Not provided"}
Colors: ${request.variantHints?.colors?.join(", ") || "Not provided"}

Rules:
1. Return ONLY valid JSON.
2. Do not invent brand names, fabric composition, certifications,
   warranty, HSN, GST, MRP, or stock.
3. Identify visible characteristics only.
4. If a field cannot be determined, use an empty string
   and add a warning.
5. Suggest sizes and colors, but do not claim that they are
   actually available in stock.
6. Only suggest variants relevant to the product category.
7. Keep title readable and suitable for ecommerce search.
8. Do not add unsupported claims like "100% cotton",
   "original branded" or "premium quality".
9. Use English for product titles and descriptions.
10. If the product is clothing, suggest standard sizes only
    when appropriate, and clearly mark them as suggestions.

Return this JSON structure:

{
  "title": "",
  "description": "",
  "shortDescription": "",
  "brand": "",
  "category": "",
  "subcategory": "",
  "productType": "",
  "highlights": [],
  "searchKeywords": [],
  "attributes": {},
  "colors": [],
  "sizes": [],
  "warnings": []
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 2500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          ...imageInputs,
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI did not return product details.");
  }

  const data = extractJson(content);

  const colors =
    request.variantHints?.colors?.length
      ? request.variantHints.colors
      : data.colors || [];

  const sizes =
    request.variantHints?.sizes?.length
      ? request.variantHints.sizes
      : data.sizes || [];

  const variants = buildVariants(colors, sizes);

  const listing: AIProductListing = {
    sellerId: request.sellerId,
    createdBy: request.sellerId,
    createdByRole: request.role,

    title: data.title,
    slug: createSlug(data.title),

    description: data.description,
    shortDescription: data.shortDescription || "",

    brand: data.brand || request.brandHint || "",

    category: data.category || request.categoryHint || "",
    subcategory: data.subcategory || "",
    productType: data.productType || "",

    highlights: data.highlights || [],
    searchKeywords: data.searchKeywords || [],
    attributes: data.attributes || {},

    images: buildImageGallery(request.images),
    variants,

    sellingPrice: null,
    wholesalePrice: null,
    mrp: null,

    hsnCode: "",
    gstRate: null,
    countryOfOrigin: "",

    status: "needs_review",

    aiGenerated: true,
    sellerConfirmed: false,
    adminApproved: false,
  };

  return listing;
}
