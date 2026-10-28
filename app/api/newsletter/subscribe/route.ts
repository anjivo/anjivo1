import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: "Please enter a valid email address." }, { status: 400 });
    }

    const docId = Buffer.from(email).toString("base64url");
    await adminDb.collection("newsletterSubscribers").doc(docId).set({
      email,
      status: "subscribed",
      source: "website-footer",
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, message: "Thanks! Your email has been subscribed." });
  } catch (error) {
    console.error("[NEWSLETTER_SUBSCRIBE]", error);
    return NextResponse.json({ success: false, message: "Newsletter service is temporarily unavailable. Please try again later." }, { status: 500 });
  }
}
