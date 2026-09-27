
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminAuth,
  adminDb,
  getAdminApp,
} from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_SCENES = [
  "white_background",
  "lifestyle",
  "studio",
  "festival",
  "fashion",
] as const;

type SceneType = (typeof ALLOWED_SCENES)[number];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 110_000,
  maxRetries: 0,
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function getScenePrompt(scene: SceneType, productName: string) {
  const base = `
You are creating a professional ecommerce product photograph.

Product name: ${productName}

Use the supplied reference image as the exact product reference.

PRODUCT PRESERVATION:
- Preserve the product's actual identity, shape, color, material,
  pattern, logo, label, packaging and visible design.
- Never invent product details, specifications, logos or text.
- Do not turn the product into a different product.
- Do not add accessories or extra products.
- Do not change the product dimensions or packaging.
- If a detail is not visible, do not invent it.
- Keep the product clearly visible and in focus.
- Do not add watermarks, promotional text or fake brand logos.
- Produce realistic commercial product photography.
`;

  const scenes: Record<SceneType, string> = {
    white_background: `
Create a clean ecommerce catalog photograph.
Use a pure white background, soft studio lighting,
realistic shadows and a centered product composition.
${base}`,
    lifestyle: `
Create a tasteful lifestyle product photograph.
Place the product in a realistic, relevant environment.
Use natural lighting and commercial photography.
The environment must not obscure or alter the product.
${base}`,
    studio: `
Create a premium studio photograph.
Use a sophisticated neutral background, softbox lighting,
subtle shadows and balanced composition.
${base}`,
    festival: `
Create a tasteful Indian festive lifestyle photograph.
Use subtle festive decoration in the background only.
Do not add offers, discounts, text or extra products.
${base}`,
    fashion: `
Create a professional fashion ecommerce photograph.
Present the supplied fashion product accurately.
Do not invent garment patterns, colors, logos or details.
Do not generate a different product.
${base}`,
  };

  return scenes[scene];
}

function getStorageObjectPath(url: URL): string | null {
  if (url.hostname === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(
      /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/
    );

    if (!match) return null;

    try {
      return decodeURIComponent(match[2]);
    } catch {
      return null;
    }
  }

  if (url.hostname === "storage.googleapis.com") {
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length < 2) return null;

    return parts.slice(1).map(decodeURIComponent).join("/");
  }

  return null;
}

function getBucketName(url: URL): string | null {
  if (url.hostname === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(
      /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/
    );

    return match?.[1] || null;
  }

  if (url.hostname === "storage.googleapis.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] || null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return jsonError(
        "OpenAI API key is not configured.",
        500
      );
    }

    // 1. Authenticate the request.
    const authorization = req.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonError("Authentication required.", 401);
    }

    const idToken = authorization.slice(7).trim();

    if (!idToken) {
      return jsonError("Invalid authentication token.", 401);
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return jsonError(
        "Your session is invalid or expired. Please sign in again.",
        401
      );
    }

    const uid = decodedToken.uid;

    // 2. Verify the user's account and role.
    const userDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      return jsonError("User account not found.", 403);
    }

    const userData = userDoc.data();

    const isAdmin =
      userData?.role === "admin" ||
      userData?.role === "superadmin";

    const isSeller =
      userData?.role === "seller" || isAdmin;

    if (!isSeller) {
      return jsonError(
        "Only sellers and admins can generate images.",
        403
      );
    }

    // 3. Validate request body.
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!body || typeof body !== "object") {
      return jsonError("Invalid request body.", 400);
    }

    const input = body as Record<string, unknown>;

    const productId =
      typeof input.productId === "string"
        ? input.productId.trim()
        : "";
    const imageUrl = input.imageUrl;
    const productName = input.productName;
    const scene = input.scene;
    const draft = input.draft === true;

    if (
      typeof imageUrl !== "string" ||
      typeof productName !== "string" ||
      typeof scene !== "string"
    ) {
      return jsonError(
        "imageUrl, productName and scene are required.",
        400
      );
    }

    if (!draft && !productId) {
      return jsonError(
        "productId is required for product image generation.",
        400
      );
    }

    if (
      productId &&
      (productId.length > 150 || productId.includes("/"))
    ) {
      return jsonError("Invalid product ID.", 400);
    }

    const cleanName = productName.trim();

    if (cleanName.length < 2 || cleanName.length > 150) {
      return jsonError("Invalid product name.", 400);
    }

    if (
      !ALLOWED_SCENES.includes(scene as SceneType)
    ) {
      return jsonError("Invalid image scene.", 400);
    }

    // 4. Resolve the product when this is a published-product request.
    // Draft mode is intentionally supported for the seller AI listing
    // workflow before a Firestore product document exists.
    let productData: Record<string, unknown> | null = null;

    if (!draft) {
      const productRef = adminDb
        .collection("products")
        .doc(productId);

      const productDoc = await productRef.get();

      if (!productDoc.exists) {
        return jsonError("Product not found.", 404);
      }

      productData =
        (productDoc.data() as Record<string, unknown>) || null;

      if (
        !isAdmin &&
        productData?.sellerId !== uid
      ) {
        return jsonError(
          "You do not own this product.",
          403
        );
      }
    }

    // 5. Validate the reference image URL.
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return jsonError("Invalid image URL.", 400);
    }

    if (
      parsedUrl.protocol !== "https:" ||
      ![
        "firebasestorage.googleapis.com",
        "storage.googleapis.com",
      ].includes(parsedUrl.hostname)
    ) {
      return jsonError(
        "Only HTTPS Firebase Storage images are accepted.",
        400
      );
    }

    const objectPath = getStorageObjectPath(parsedUrl);
    const bucketName = getBucketName(parsedUrl);

    if (!objectPath || !bucketName) {
      return jsonError(
        "Invalid Firebase Storage object URL.",
        400
      );
    }

    // 6. Verify the Storage object belongs to the product/seller.
    const storage = getStorage(getAdminApp());
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);

    const [fileExists] = await file.exists();

    if (!fileExists) {
      return jsonError(
        "Reference image not found in Firebase Storage.",
        404
      );
    }

    const [metadata] = await file.getMetadata();

    const contentType = metadata.contentType || "";

    const supportedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!supportedTypes.includes(contentType)) {
      return jsonError(
        "Only JPG, PNG and WebP images are supported.",
        400
      );
    }

    const fileSize = Number(metadata.size || 0);

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_IMAGE_SIZE
    ) {
      return jsonError(
        "Image must be smaller than 10 MB.",
        400
      );
    }

    // Verify ownership of the reference image.
    // Draft AI listing uploads live under ai-listings/{uid}/.
    const productImages = Array.isArray(productData?.images)
      ? productData.images
      : [];

    const productImageUrls = productImages
      .map((item: unknown) => {
        if (typeof item === "string") return item;

        if (
          item &&
          typeof item === "object" &&
          "url" in item &&
          typeof (item as { url?: unknown }).url === "string"
        ) {
          return (item as { url: string }).url;
        }

        return null;
      })
      .filter(
        (item: string | null): item is string =>
          typeof item === "string"
      );

    const productImagePaths = productImageUrls
      .map((url) => {
        try {
          return getStorageObjectPath(new URL(url));
        } catch {
          return null;
        }
      })
      .filter(
        (path: string | null): path is string =>
          typeof path === "string"
      );

    const belongsToProduct =
      productImagePaths.includes(objectPath) ||
      objectPath.startsWith(`products/${productId}/`) ||
      objectPath.startsWith(`products/${uid}/`);

    const belongsToDraft =
      objectPath.startsWith(`ai-listings/${uid}/`);

    if (
      !isAdmin &&
      !(draft ? belongsToDraft : belongsToProduct)
    ) {
      return jsonError(
        "Reference image is not associated with your seller account.",
        403
      );
    }

    // 7. Download the verified image from Firebase Storage.
    const [imageBuffer] = await file.download();

    if (
      imageBuffer.length === 0 ||
      imageBuffer.length > MAX_IMAGE_SIZE
    ) {
      return jsonError(
        "Image must be smaller than 10 MB.",
        400
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

    // 8. Generate the image with OpenAI.
    const result = await openai.images.edit({
      model: "gpt-image-2",
      image: inputFile,
      prompt: getScenePrompt(
        scene as SceneType,
        cleanName
      ),
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
    });

    const generatedImage = result.data?.[0]?.b64_json;

    if (!generatedImage) {
      return jsonError(
        "AI did not return an image. Please try again.",
        502
      );
    }

    // 9. Log the generation event.
    await adminDb.collection("ai_image_jobs").add({
      productId: productId || null,
      draft: draft,
      sellerId: productData?.sellerId || uid,
      requestedBy: uid,
      scene,
      status: "generated_pending_review",
      referenceImagePath: objectPath,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 10. Return the image for seller review.
    // The client must upload the approved image to
    // Firebase Storage before publishing the product.
    return NextResponse.json({
      success: true,
      image: `data:image/jpeg;base64,${generatedImage}`,
      scene,
      isAIGenerated: true,
      requiresSellerReview: true,
      message:
        "Generated image is ready. Review it before saving or publishing.",
    });
  } catch (error) {
    console.error("AI image generation error:", error);

    return jsonError(
      "Image generation failed. Please try again.",
      500
    );
  }
}
