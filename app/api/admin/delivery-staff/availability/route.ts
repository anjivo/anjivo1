
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_ORDERS = 10;
const MAX_ORDERS_TO_SCAN = 1000;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isTerminalOrder(order: Record<string, unknown>): boolean {
  const terminalStatuses = new Set([
    "delivered",
    "cancelled",
    "canceled",
    "returned",
    "refunded",
  ]);

  return [
    order.status,
    order.orderStatus,
    order.fulfillmentStatus,
    order.deliveryAssignmentStatus,
  ].some((status) => terminalStatuses.has(normalize(status)));
}

function toMillis(value: unknown): number | null {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (value instanceof Date) return value.getTime();

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);

    const adminSnapshot = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!adminSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Admin account not found." },
        { status: 403 }
      );
    }

    const adminData = adminSnapshot.data()!;

    if (
      !["ADMIN", "SUPERADMIN"].includes(
        String(adminData.role ?? "").toUpperCase()
      ) ||
      String(adminData.accountStatus ?? "").toUpperCase() !== "ACTIVE"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin access denied." },
        { status: 403 }
      );
    }

    const [staffSnapshot, ordersSnapshot] = await Promise.all([
      adminDb.collection("deliveryPartners").limit(500).get(),
      adminDb.collection("orders").limit(MAX_ORDERS_TO_SCAN).get(),
    ]);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const orders = ordersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const staff = staffSnapshot.docs.map((doc) => {
      const data = doc.data();
      const staffId = doc.id;
      const status = normalize(data.status);

      const assignedOrders = orders.filter((order) => {
        const orderData = order as Record<string, unknown>;

        return (
          String(orderData.deliveryPartnerId ?? "") === staffId &&
          !isTerminalOrder(orderData)
        );
      });

      const deliveredToday = orders.filter((order) => {
        const orderData = order as Record<string, unknown>;

        if (
          String(orderData.deliveryPartnerId ?? "") !== staffId ||
          ![
            "delivered",
          ].includes(normalize(orderData.deliveryAssignmentStatus)) &&
          ![
            "delivered",
          ].includes(normalize(orderData.status)) &&
          ![
            "delivered",
          ].includes(normalize(orderData.orderStatus)) &&
          ![
            "delivered",
          ].includes(normalize(orderData.fulfillmentStatus))
        ) {
          return false;
        }

        const deliveredAt =
          toMillis(orderData.deliveredAt) ??
          toMillis(orderData.deliveryStatusUpdatedAt) ??
          toMillis(orderData.updatedAt);

        return deliveredAt !== null && deliveredAt >= startOfToday;
      }).length;

      const active = ["active", "approved", "available"].includes(status);
      const activeAssignedOrders = assignedOrders.length;

      return {
        id: staffId,
        name: String(data.name ?? ""),
        email: String(data.email ?? ""),
        phone: String(data.phone ?? ""),
        status: data.status ?? "unknown",
        serviceArea: data.serviceArea ?? null,
        vehicleType: data.vehicleType ?? null,
        activeAssignedOrders,
        deliveredToday,
        maxActiveOrders: MAX_ACTIVE_ORDERS,
        isAvailable: active && activeAssignedOrders < MAX_ACTIVE_ORDERS,
        workload:
          activeAssignedOrders >= MAX_ACTIVE_ORDERS
            ? "full"
            : activeAssignedOrders >= Math.ceil(MAX_ACTIVE_ORDERS * 0.7)
              ? "busy"
              : "available",
      };
    });

    return NextResponse.json({
      success: true,
      staff,
      summary: {
        totalStaff: staff.length,
        activeStaff: staff.filter((item) =>
          ["active", "approved", "available"].includes(
            normalize(item.status)
          )
        ).length,
        availableStaff: staff.filter((item) => item.isAvailable).length,
        busyStaff: staff.filter((item) => item.workload === "busy").length,
        fullStaff: staff.filter((item) => item.workload === "full").length,
        ordersScanLimit: MAX_ORDERS_TO_SCAN,
        ordersScanMayBeIncomplete:
          ordersSnapshot.size >= MAX_ORDERS_TO_SCAN,
        staffScanMayBeIncomplete: staffSnapshot.size >= 500,
      },
    });
  } catch (error) {
    console.error("[DELIVERY STAFF AVAILABILITY]", error);

    return NextResponse.json(
      { success: false, error: "Unable to load delivery staff availability." },
      { status: 500 }
    );
  }
}
