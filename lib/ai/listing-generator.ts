
import OpenAI from "openai";

export type GeneratedListing = {
  title: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  keywords: string[];
  images: string[];
  sellerId: string;
};

export type GenerateListingInput = {
  images: string[];
  sellerId: string;
  productName?: string;
  category?: string;
  brand?: string;
  language?: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateListing(
  input: GenerateListingInput
): Promise<GeneratedListing> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const {
    images,
    sellerId,
    productName,
    category,
    brand,
    language = "English",
  } = input;

  if (!sellerId) {
    throw new Error("Seller ID is required.");
  }

  if (
    (!productName || !productName.trim()) &&
    (!images || images.length === 0)
  ) {
    throw new Error(
      "Product name or at least one image is required."
    );
  }

  const prompt = `
You are an ecommerce product listing assistant for ANJIVO.

Create a professional product listing using the supplied information.

Product name: ${productName || "Identify from the image"}
Category: ${category || "Suggest an appropriate category"}
Brand: ${brand || "Identify only if clearly visible; otherwise Unbranded"}
Language: ${language}

Rules:
1. Generate a clear, SEO-friendly product title.
2. Write a useful ecommerce product description in the requested language.
3. Suggest a relevant product category.
4. Do not invent specifications, certifications, materials, or guarantees.
5. Do not invent a brand if it is not known.
6. Price and stock must be 0. The seller will set these values.
7. Generate relevant search keywords.
8. Return valid JSON only.

JSON format:
{
  "title": "Product title",
  "description": "Product description",
  "category": "Category",
  "brand": "Brand or Unbranded",
  "keywords": ["keyword1", "keyword2"]
}
`;

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
    [
      {
        type: "text",
        text: prompt,
      },
    ];

  // Include product images for visual analysis.
  for (const imageUrl of images || []) {
    if (
      typeof imageUrl === "string" &&
      /^https?:\/\//i.test(imageUrl)
    ) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
          detail: "low",
        },
      });
    }
  }

  const completion =
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate accurate ecommerce product listings. Return only valid JSON.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      response_format: {
        type: "json_object",
      },
      temperature: 0.4,
    });

  const content =
    completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned an empty response.");
  }

  const parsed = JSON.parse(content);

  return {
    title: String(parsed.title || productName || ""),
    description: String(parsed.description || ""),
    category: String(parsed.category || category || ""),
    brand: String(parsed.brand || brand || "Unbranded"),
    price: 0,
    stock: 0,
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map(String)
      : [],
    images: images || [],
    sellerId,
  };
}
