
import OpenAI from "openai";

export type GeneratedListing = {
  title: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  keywords: string[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateListing(
  productName: string,
  category = "",
  brand = ""
): Promise<GeneratedListing> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (!productName.trim()) {
    throw new Error("Product name is required.");
  }

  const prompt = `
Generate a professional ecommerce product listing for ANJIVO.

Product name: ${productName}
Category: ${category || "Suggest an appropriate category"}
Brand: ${brand || "Unbranded"}

Requirements:
1. Create a clear SEO-friendly product title.
2. Write an accurate, professional product description.
3. Suggest an appropriate category.
4. Use the supplied brand, or "Unbranded" if none is provided.
5. Suggest relevant search keywords.
6. Do not invent certifications, product specifications, or guarantees.
7. Set price and stock to 0 because these must be supplied by the seller.

Return valid JSON with exactly these fields:
title, description, category, brand, price, stock, keywords.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an ecommerce product listing assistant. Return only valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_object",
    },
    temperature: 0.4,
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned an empty response.");
  }

  const parsed = JSON.parse(content);

  return {
    title: String(parsed.title || productName),
    description: String(parsed.description || ""),
    category: String(parsed.category || category),
    brand: String(parsed.brand || brand || "Unbranded"),
    price: 0,
    stock: 0,
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map(String)
      : [],
  };
}
