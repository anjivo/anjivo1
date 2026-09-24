
export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(
        authorization.slice(7).trim()
      );
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token." },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;

    const adminDoc = await adminDb
      .collection("users")
      .doc(uid)
      .get();

    const adminData = adminDoc.data();

    const isAdmin =
      adminDoc.exists &&
      (
        String(adminData?.role ?? "").toLowerCase() === "admin" ||
        decodedToken.admin === true
      );

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const snapshot = await adminDb
      .collection("products")
      .where("status", "==", "pending_review")
      .limit(50)
      .get();

    const listings = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        title: data.title ?? data.name ?? "",
        description: data.description ?? "",
        category: data.category ?? "",
        brand: data.brand ?? "",
        price: data.price ?? null,
        stock: data.stock ?? null,
        images: data.images ?? data.imageUrls ?? [],
        sellerId: data.sellerId ?? "",
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      listings,
      count: listings.length,
    });
  } catch (error) {
    console.error("Fetch pending listings error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch pending listings." },
      { status: 500 }
    );
  }
}
