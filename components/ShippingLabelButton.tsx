"use client";

import bwipjs from "bwip-js";

type LabelAddress = {
  fullName?: string;
  // Kept for compatibility with existing order data; never printed.
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
  /** Prefer passing the tracking ID saved on the order in Firestore. */
  trackingId?: string;
  /** Optional public tracking-page URL. If omitted, the ANJIVO tracking URL is generated. */
  trackingUrl?: string;
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

function createStableTrackingId(orderId: string): string {
  const safeOrderId = String(orderId)
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return `ANJ-${safeOrderId || "ORDER"}`;
}

function makeBarcode(text: string): string {
  const canvas = document.createElement("canvas");
  bwipjs.toCanvas(canvas, {
    bcid: "code128",
    text,
    scale: 2,
    height: 12,
    includetext: true,
    textxalign: "center",
    textsize: 10,
  });
  return canvas.toDataURL("image/png");
}

function makeQrCode(text: string): string {
  const canvas = document.createElement("canvas");
  bwipjs.toCanvas(canvas, {
    bcid: "qrcode",
    text,
    scale: 4,
    eclevel: "M",
  });
  return canvas.toDataURL("image/png");
}

export default function ShippingLabelButton({
  orderId,
  trackingId,
  trackingUrl,
  shippingAddress,
  items,
  paymentMethod,
  paymentStatus: _paymentStatus,
  totalAmount: _totalAmount,
  sellerId,
  sellerName: _sellerName,
  variant = "label",
}: ShippingLabelButtonProps) {
  async function printLabel() {
    const normalizedOrderId = String(orderId ?? "").trim();
    if (!normalizedOrderId) {
      window.alert("Order ID available nahi hai. Shipping label generate nahi ho sakta.");
      return;
    }

    const address = shippingAddress ?? {};

    // Admin label: all order items. Seller label: only that seller's items.
    const labelItems = (items ?? []).filter((item) => {
      if (!sellerId) return true;
      return item.sellerId === sellerId;
    });

    const resolvedTrackingId = String(trackingId ?? "").trim() ||
      createStableTrackingId(normalizedOrderId);
    const resolvedTrackingUrl = trackingUrl?.trim() ||
      `https://anjivo.online/track-order?trackingId=${encodeURIComponent(resolvedTrackingId)}`;

    const isCod = ["COD", "CASH ON DELIVERY", "CASH_ON_DELIVERY"].includes(
      String(paymentMethod ?? "").trim().toUpperCase()
    );
    const orderType = isCod ? "COD" : "PREPAID";

    let barcodeDataUrl: string;
    let qrDataUrl: string;
    try {
      barcodeDataUrl = makeBarcode(resolvedTrackingId);
      qrDataUrl = makeQrCode(resolvedTrackingUrl);
    } catch (error) {
      console.error("Shipping label barcode/QR generation failed:", error);
      window.alert("Barcode/QR generate nahi ho paya. Please dobara try karein.");
      return;
    }

    const itemRows = labelItems
      .map((item) => {
        const name = escapeHtml(item.name || item.productName || "Product");
        const quantityValue = Number(item.quantity ?? 0);
        const quantity = Number.isFinite(quantityValue) && quantityValue > 0
          ? quantityValue
          : 0;
        const rawVariant = item.variantLabel ||
          [item.size, item.color].filter(Boolean).join(" / ");
        const variantText = escapeHtml(rawVariant);

        return `
          <tr>
            <td class="product">
              <strong>${name}</strong>
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

    const logoUrl = `${window.location.origin}/logo/anjivo-logo.png`;

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ANJIVO Shipping Label</title>
<style>
  @page { size: 4in 6in; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label {
    width: 4in;
    min-height: 6in;
    padding: .19in;
    background: #fff;
    border: 1px solid #111;
    page-break-after: always;
    break-after: page;
    overflow-wrap: anywhere;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .logo {
    display: block;
    width: 135px;
    max-height: 43px;
    object-fit: contain;
    object-position: left center;
  }
  .website {
    margin-top: 3px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .3px;
  }
  .order-type {
    flex: 0 0 auto;
    border: 2px solid #111;
    padding: 6px 9px;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: .5px;
  }
  .ids {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    margin-top: 9px;
    padding: 7px 8px;
    border: 1.5px solid #111;
  }
  .id-line { font-size: 9px; line-height: 1.35; }
  .id-line strong { font-size: 10px; }
  .tracking-value { font-size: 12px !important; letter-spacing: .35px; }
  .section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 2px solid #111;
  }
  .heading {
    margin-bottom: 6px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .customer-name {
    margin-bottom: 6px;
    font-size: 17px;
    line-height: 1.15;
    font-weight: 900;
  }
  .address { font-size: 11px; line-height: 1.4; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
  }
  td {
    padding: 6px 3px;
    border-bottom: 1px solid #aaa;
    vertical-align: top;
  }
  .product { overflow-wrap: anywhere; }
  .product strong { display: block; font-size: 10px; line-height: 1.3; }
  .product small { display: block; margin-top: 3px; font-size: 9px; font-weight: 700; }
  .qty { width: 38px; text-align: right; font-size: 11px; font-weight: 900; }
  .empty { padding: 9px 3px; font-size: 10px; }
  .codes {
    display: grid;
    grid-template-columns: 1fr 76px;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1.5px dashed #555;
  }
  .barcode { display: block; width: 100%; max-height: 58px; object-fit: contain; }
  .qr { display: block; width: 72px; height: 72px; object-fit: contain; }
  .code-caption { margin-top: 3px; text-align: center; font-size: 8px; font-weight: 700; }
  .footer {
    display: flex;
    justify-content: center;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px dashed #555;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .4px;
  }
  @media screen {
    body { padding: 12px; background: #eee; }
    .label { margin: 0 auto; box-shadow: 0 2px 10px #bbb; }
  }
</style>
</head>
<body>
  <article class="label">
    <header class="header">
      <div>
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="ANJIVO">
        <div class="website">anjivo.online</div>
      </div>
      <div class="order-type">${orderType}</div>
    </header>

    <section class="ids">
      <div class="id-line"><strong>ORDER ID:</strong> ${escapeHtml(normalizedOrderId)}</div>
      <div class="id-line"><strong>TRACKING ID:</strong> <strong class="tracking-value">${escapeHtml(resolvedTrackingId)}</strong></div>
    </section>

    <section class="section">
      <div class="heading">Ship To</div>
      <div class="customer-name">${escapeHtml(address.fullName || "Customer")}</div>
      <div class="address">
        ${addressLines || "<div>Address not available</div>"}
      </div>
    </section>

    <section class="section">
      <div class="heading">Package Contents</div>
      <table>
        <tbody>
          ${itemRows || '<tr><td class="empty" colspan="2">Product details not available</td></tr>'}
        </tbody>
      </table>
    </section>

    <section class="codes">
      <div>
        <img class="barcode" src="${barcodeDataUrl}" alt="Tracking barcode">
        <div class="code-caption">SCAN BARCODE · ${escapeHtml(resolvedTrackingId)}</div>
      </div>
      <div>
        <img class="qr" src="${qrDataUrl}" alt="Tracking QR code">
        <div class="code-caption">SCAN TO TRACK</div>
      </div>
    </section>

    <footer class="footer">anjivo.online</footer>
  </article>
  <script>
    window.onload = () => {
      const images = Array.from(document.images);
      Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })).then(() => setTimeout(() => window.print(), 250));
    };
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=520,height=760");
    if (!printWindow) {
      window.alert("Shipping label print karne ke liye browser mein pop-ups allow karein.");
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
