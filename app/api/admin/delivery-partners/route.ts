
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(
      authorization.slice(7).trim()
    );
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 }
      ),
    };
  }

  const userDoc = await adminDb
    .collection("users")
    .doc(decodedToken.uid)
    .get();

  const role = String(userDoc.data()?.role ?? "")
    .trim()
    .toLowerCase();

  const allowed =
    userDoc.exists &&
    (role === "admin" ||
      role === "superadmin" ||
      decodedToken.admin === true);

  if (!allowed) {
    return {
      error: NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { uid: decodedToken.uid };
}

function serializePartner(id: string, data: DocumentData) {
  const timestampToIso = (value: unknown): string | null => {
    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      return (
        value as { toDate: () => Date }
      ).toDate().toISOString();
    }

    return null;
  };

  return {
    id,
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    vehicleType: String(data.vehicleType ?? "bike"),
    serviceArea: String(data.serviceArea ?? ""),
    status: data.status === "active" ? "active" : "inactive",
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

// GET: List delivery partners
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if ("error" in auth) {
      return auth.error;
    }

    const snapshot = await adminDb
      .collection("deliveryPartners")
      .limit(300)
      .get();

    const partners = snapshot.docs
      .map((doc) => serializePartner(doc.id, doc.data()))
      .sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );

    return NextResponse.json({
      success: true,
      partners,
      count: partners.length,
    });
  } catch (error) {
    console.error("List delivery partners error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load delivery partners." },
      { status: 500 }
    );
  }
}

// POST: Create a delivery partner profile
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if ("error" in auth) {
      return auth.error;
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const vehicleType =
      typeof body.vehicleType === "string"
        ? body.vehicleType
        : "bike";

    const serviceArea =
      typeof body.serviceArea === "string"
        ? body.serviceArea.trim()
        : "";

    const digits = phone.replace(/\D/g, "");

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Name must be 2–100 characters." },
        { status: 400 }
      );
    }

    if (digits.length < 10 || digits.length > 13) {
      return NextResponse.json(
        { success: false, error: "Enter a valid phone number." },
        { status: 400 }
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { success: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (
      !["bike", "scooter", "bicycle", "car", "van", "other"].includes(
        vehicleType
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Select a valid vehicle type." },
        { status: 400 }
      );
    }

    if (!serviceArea || serviceArea.length > 160) {
      return NextResponse.json(
        { success: false, error: "Service area is required." },
        { status: 400 }
      );
    }

    const normalizedPhone =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits;

    const existing = await adminDb
      .collection("deliveryPartners")
      .where("phoneNormalized", "==", normalizedPhone)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        {
          success: false,
          error: "This phone number is already registered.",
        },
        { status: 409 }
      );
    }

    const docRef = adminDb.collection("deliveryPartners").doc();

    await docRef.set({
      name,
      phone,
      phoneNormalized: normalizedPhone,
      email,
      vehicleType,
      serviceArea,
      status: "inactive",
      authUid: null,
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const saved = await docRef.get();

    return NextResponse.json(
      {
        success: true,
        partner: serializePartner(
          saved.id,
          saved.data() ?? {}
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create delivery partner error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to create delivery partner." },
      { status: 500 }
    );
  }
}

// PATCH: Activate or deactivate a partner
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if ("error" in auth) {
      return auth.error;
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const partnerId =
      typeof body.partnerId === "string"
        ? body.partnerId.trim()
        : "";

    const status = body.status;

    if (
      !partnerId ||
      (status !== "active" && status !== "inactive")
    ) {
      return NextResponse.json(
        { success: false, error: "Valid partnerId and status are required." },
        { status: 400 }
      );
    }

    const ref = adminDb
      .collection("deliveryPartners")
      .doc(partnerId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Delivery partner not found." },
        { status: 404 }
      );
    }

    await ref.update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: auth.uid,
    });

    const updated = await ref.get();

    return NextResponse.json({
      success: true,
      partner: serializePartner(
        updated.id,
        updated.data() ?? {}
      ),
    });
  } catch (error) {
    console.error("Update delivery partner error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update delivery partner." },
      { status: 500 }
    );
  }
}
