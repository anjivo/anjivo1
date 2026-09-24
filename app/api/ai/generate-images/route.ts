
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_SCENES = [
  "white_background",
  "lifestyle",
  "studio",
  "festival",
  "fashion",
] as const;

type SceneType = (typeof ALLOWED_SCENES)[number];

function getScenePrompt(
  scene: SceneType,
  productName: string
): string {
  const base = `
You are creating an ecommerce product marketing image.

Product name: ${productName}

Use the supplied reference image as the exact product reference.

IMPORTANT PRODUCT PRESERVATION RULES:
- Preserve the actual product's identity, shape, color, material,
  pattern, logos, labels, and visible design.
- Do not invent unseen product details, brand names, or text.
- Do not change the product into a different product.
- Do not add accessories or items that are not shown.
- Do not modify product dimensions or packaging.
- If a detail is not visible in the reference, do not invent it.
- Create a realistic, professional ecommerce photograph.
- Do not add watermarks, promotional text, or fake brand logos.
- The product should be clearly visible and in focus.
`;

  const scenePrompts: Record<SceneType, string> = {
    white_background: `
Create a clean ecommerce catalog photograph.
Use a pure white background, soft natural studio lighting,
realistic shadows, and a centered product composition.
${base}
`,
    lifestyle: `
Create a tasteful lifestyle product photograph.
Place the product in a realistic, relevant environment.
Use natural lighting and professional commercial photography.
The environment must not obscure or alter the product.
${base}
`,
    studio: `
Create a premium studio product photograph.
Use a sophisticated neutral studio background,
softbox lighting, subtle shadows, and balanced composition.
${base}
`,
    festival: `
Create an ecommerce promotional lifestyle photograph
with a tasteful Indian festive setting.
Use subtle decorative elements in the background only.
Do not add text, discounts, offers, or extra products.
${base}
`,
    fashion: `
Create a professional fashion ecommerce photograph.
Show the supplied garment or fashion product as accurately
as possible, with realistic lighting and styling.
Do not invent garment patterns, logos, colors, or details.
Do not generate a different product or claim unseen features.
${base}
`,
  };

  return scenePrompts[scene];
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    // 1. Authenticate user using Firebase ID token
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    const uid = decodedToken.uid;

    // 2. Check user role
    const userDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 403 }
      );
    }

    const userData = userDoc.data();

    const isAdmin =
      userData?.role === "admin" ||
      userData?.role === "superadmin";

    const isSeller =
      userData?.role === "seller" ||
      userData?.role === "admin" ||
      userData?.role === "superadmin";

    if (!isSeller) {
      return NextResponse.json(
        { error: "Only sellers and admins can generate images." },
        { status: 403 }
      );
    }

    // 3. Read request body
    const body = await req.json();

    const {
      productId,
      imageUrl,
      productName,
      scene,
    }: {
      productId?: string;
      imageUrl?: string;
      productName?: string;
      scene?: SceneType;
    } = body;

    if (
      !productId ||
      !imageUrl ||
      !productName ||
      !scene
    ) {
      return NextResponse.json(
        {
          error:
            "productId, imageUrl, productName and scene are required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_SCENES.includes(scene)) {
      return NextResponse.json(
        { error: "Invalid image scene." },
        { status: 400 }
      );
    }

    if (
      typeof productName !== "string" ||
      productName.trim().length < 2 ||
      productName.length > 150
    ) {
      return NextResponse.json(
        { error: "Invalid product name." },
        { status: 400 }
      );
    }

    // 4. Verify product ownership
    const productRef = adminDb
      .collection("products")
      .doc(productId);

    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const productData = productDoc.data();

    if (
      !isAdmin &&
      productData?.sellerId !== uid
    ) {
      return NextResponse.json(
        { error: "You do not own this product." },
        { status: 403 }
      );
    }

    // 5. Check the reference image is an allowed Firebase URL
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid image URL." },
        { status: 400 }
      );
    }

    const isFirebaseStorage =
      parsedUrl.protocol === "https:" &&
      (
        parsedUrl.hostname === "firebasestorage.googleapis.com" ||
        parsedUrl.hostname === "storage.googleapis.com"
      );

    if (!isFirebaseStorage) {
      return NextResponse.json(
        {
          error:
            "Only Firebase Storage images are accepted.",
        },
        { status: 400 }
      );
    }

    // IMPORTANT:
    // Before production, verify the Storage object path
    // belongs to this seller using Firebase Admin Storage.
    // A valid Firebase URL alone does not prove ownership.

    // 6. Download image from Firebase Storage
    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Unable to access the reference image." },
        { status: 400 }
      );
    }

    const contentType =
      imageResponse.headers.get("content-type") || "";

    const supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!supportedTypes.includes(contentType)) {
      return NextResponse.json(
        {
          error:
            "Only JPG, PNG, and WebP images are supported.",
        },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    if (
      imageBuffer.length === 0 ||
      imageBuffer.length > 10 * 1024 * 1024
    ) {
      return NextResponse.json(
        { error: "Image must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    const extension =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
        ? "webp"
        : "jpg";

    const inputFile = new File(
      [new Uint8Array(imageBuffer)],
      `product-reference.${extension}`,
      { type: contentType }
    );

    // 7. Generate a single edited product image
    const result = await openai.images.edit({
      model: "gpt-image-2",
      image: inputFile,
      prompt: getScenePrompt(
        scene,
        productName.trim()
      ),
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
    });

    const generatedImage =
      result.data?.[0]?.b64_json;

    if (!generatedImage) {
      return NextResponse.json(
        { error: "AI did not return an image." },
        { status: 502 }
      );
    }

    // 8. Return image for seller review.
    // The client must upload the approved image to
    // Firebase Storage before product confirmation.
    const dataUrl =
      `data:image/jpeg;base64,${generatedImage}`;

    // Log the generation event for audit purposes.
    await adminDb
      .collection("ai_image_jobs")
      .add({
        productId,
        sellerId: productData?.sellerId || uid,
        requestedBy: uid,
        scene,
        status: "generated_pending_review",
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      image: dataUrl,
      scene,
      isAIGenerated: true,
      requiresSellerReview: true,
      message:
        "Generated image is ready. Review it before saving or publishing.",
    });
  } catch (error) {
    console.error("AI image generation error:", error);

    return NextResponse.json(
      {
        error:
          "Image generation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
