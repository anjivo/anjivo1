
"use client";

type LabelAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type LabelItem = {
  name?: string;
  productName?: string;
  quantity?: number;
  sellerId?: string;
  size?: string;
  color?: string;
  variantLabel?: string;
  selectedPrice?: number;
  unitPrice?: number;
  price?: number;
  subtotal?: number;
};

type ShippingLabelButtonProps = {
  orderId: string;
  shippingAddress?: LabelAddress;
  items: LabelItem[];
  paymentMethod?: string;
  paymentStatus?: string;
  totalAmount?: number;
  sellerId?: string;
  sellerName?: string;
  variant?: "label" | "compact";
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getItemPrice(item: LabelItem): number {
  const price = Number(
    item.selectedPrice ?? item.unitPrice ?? item.price ?? 0
  );

  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function getItemSubtotal(item: LabelItem): number {
  const quantity = Math.max(0, Number(item.quantity ?? 0));
  const subtotal = Number(item.subtotal);

  if (Number.isFinite(subtotal) && subtotal >= 0 && item.subtotal !== undefined) {
    return subtotal;
  }

  return getItemPrice(item) * quantity;
}

export default function ShippingLabelButton({
  orderId,
  shippingAddress,
  items,
  paymentMethod,
  paymentStatus,
  totalAmount,
  sellerId,
  sellerName,
  variant = "label",
}: ShippingLabelButtonProps) {
  function printLabel() {
    const address = shippingAddress ?? {};

    // Admin: poore order ke items.
    // Seller: sirf us seller ke items.
    const labelItems = (items ?? []).filter((item) => {
      if (!sellerId) return true;
      return item.sellerId === sellerId;
    });

    const isCod =
      String(paymentMethod ?? "").trim().toUpperCase() === "COD";

    const normalizedPaymentStatus = String(paymentStatus ?? "")
      .trim()
      .toLowerCase();

    const isPaid = normalizedPaymentStatus === "paid";

    const isSellerLabel = Boolean(sellerId);

    const sellerItemsAmount = labelItems.reduce(
      (sum, item) => sum + getItemSubtotal(item),
      0
    );

    // Admin label par full order total.
    // Seller label par sirf seller ke products ka subtotal.
    // Seller subtotal mein order-level shipping/discount include nahi hain.
    const amountToCollect = isSellerLabel
      ? sellerItemsAmount
      : Math.max(0, Number(totalAmount ?? 0));

    const showCodCollection = isCod && !isPaid;

    const itemRows = labelItems
      .map((item) => {
        const name = escapeHtml(
          item.name || item.productName || "Product"
        );

        const quantityValue = Number(item.quantity ?? 0);
        const quantity =
          Number.isFinite(quantityValue) && quantityValue > 0
            ? quantityValue
            : 0;

        const rawVariant =
          item.variantLabel ||
          [item.size, item.color].filter(Boolean).join(" / ");

        const variantText = escapeHtml(rawVariant);

        return `
          <tr>
            <td>
              ${name}
              ${variantText ? `<small>${variantText}</small>` : ""}
            </td>
            <td class="qty">${quantity}</td>
          </tr>
        `;
      })
      .join("");

    const addressLines = [
      address.addressLine1,
      address.addressLine2,
      [address.city, address.state].filter(Boolean).join(", "),
      address.pincode ? `PIN: ${address.pincode}` : "",
    ]
      .filter(Boolean)
      .map((line) => `<div>${escapeHtml(line)}</div>`)
      .join("");

    const collectionSection = showCodCollection
      ? `
        <div class="payment">
          <div>
            <div class="heading">Collect on Delivery</div>
            <strong>₹${amountToCollect.toLocaleString("en-IN")}</strong>
          </div>
          <div class="muted">COD — verify order amount</div>
        </div>
      `
      : `
        <div class="payment">
          <div>
            <div class="heading">Payment</div>
            <strong>${isPaid ? "PAID" : escapeHtml(paymentMethod || "See order details")}</strong>
          </div>
          <div class="muted">
            ${isPaid ? "Payment received" : "Check payment status"}
          </div>
        </div>
      `;

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Shipping Label ${escapeHtml(orderId)}</title>
<style>
@page { size: 4in 6in; margin: 0; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
}
.label {
  width: 4in;
  min-height: 6in;
  padding: .22in;
  border: 1px solid #111;
  page-break-after: always;
}
.brand {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 1px;
}
.sub {
  font-size: 9px;
  letter-spacing: 2px;
  margin-top: 2px;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.tag {
  border: 2px solid #111;
  padding: 5px 8px;
  font-weight: 900;
  font-size: 12px;
}
.section {
  border-top: 2px solid #111;
  margin-top: 10px;
  padding-top: 9px;
}
.heading {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 5px;
}
.name {
  font-size: 18px;
  font-weight: 900;
  line-height: 1.15;
  margin-bottom: 6px;
}
.address {
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.phone {
  font-size: 16px;
  font-weight: 900;
  margin-top: 7px;
}
.order {
  font-size: 12px;
  font-weight: 900;
  overflow-wrap: anywhere;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}
td {
  padding: 5px 2px;
  border-bottom: 1px solid #bbb;
  vertical-align: top;
}
td small {
  display: block;
  margin-top: 2px;
}
.qty {
  width: 35px;
  text-align: right;
  font-weight: 900;
}
.payment {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  border: 2px solid #111;
  padding: 8px;
}
.payment strong { font-size: 16px; }
.muted { font-size: 9px; text-align: right; }
.footer {
  margin-top: 12px;
  border-top: 1px dashed #555;
  padding-top: 7px;
  font-size: 9px;
  display: flex;
  justify-content: space-between;
}
@media screen {
  body { background: #eee; padding: 12px; }
  .label {
    background: white;
    margin: 0 auto;
    box-shadow: 0 2px 10px #bbb;
  }
}
</style>
</head>
<body>
<article class="label">
  <div class="row">
    <div>
      <div class="brand">ANJIVO</div>
      <div class="sub">SHIPPING LABEL</div>
    </div>
    <div class="tag">${isCod ? "COD" : "PREPAID"}</div>
  </div>

  <div class="section">
    <div class="heading">Ship To</div>
    <div class="name">${escapeHtml(address.fullName || "Customer")}</div>
    <div class="address">
      ${addressLines || "<div>Address not available</div>"}
    </div>
    <div class="phone">
      ${escapeHtml(address.phone || "Phone not available")}
    </div>
  </div>

  <div class="section">
    <div class="heading">Order Reference</div>
    <div class="order">#${escapeHtml(orderId)}</div>
  </div>

  <div class="section">
    <div class="heading">Package Contents</div>
    <table>
      ${itemRows || "<tr><td>Items unavailable</td><td>—</td></tr>"}
    </table>
  </div>

  ${collectionSection}

  ${
    sellerName
      ? `<div class="section">
          <div class="heading">Seller</div>
          <div class="order">${escapeHtml(sellerName)}</div>
        </div>`
      : ""
  }

  <div class="footer">
    <span>ANJIVO</span>
    <span>${new Date().toLocaleDateString("en-IN")}</span>
  </div>
</article>
<script>
  window.onload = () => {
    setTimeout(() => window.print(), 300);
  };
</script>
</body>
</html>`;

    const printWindow = window.open(
      "",
      "_blank",
      "width=520,height=760"
    );

    if (!printWindow) {
      window.alert(
        "Shipping label print karne ke liye browser mein pop-ups allow karein."
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <button
      type="button"
      onClick={printLabel}
      className={
        variant === "compact"
          ? "inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:border-black"
          : "inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
      }
    >
      🏷️ Generate Shipping Label
    </button>
  );
}
