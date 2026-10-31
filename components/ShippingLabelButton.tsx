"use client";

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

export default function ShippingLabelButton({
  orderId: _orderId,
  shippingAddress,
  items,
  paymentMethod,
  paymentStatus: _paymentStatus,
  totalAmount: _totalAmount,
  sellerId,
  sellerName: _sellerName,
  variant = "label",
}: ShippingLabelButtonProps) {
  function printLabel() {
    const address = shippingAddress ?? {};

    // Admin label: all order items. Seller label: only that seller's items.
    const labelItems = (items ?? []).filter((item) => {
      if (!sellerId) return true;
      return item.sellerId === sellerId;
    });

    const isCod =
      String(paymentMethod ?? "").trim().toUpperCase() === "COD";
    const orderType = isCod ? "COD" : "PREPAID";

    const itemRows = labelItems
      .map((item) => {
        const name = escapeHtml(item.name || item.productName || "Product");
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
    padding: .22in;
    background: #fff;
    border: 1px solid #111;
    page-break-after: always;
    overflow-wrap: anywhere;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .logo {
    display: block;
    width: 145px;
    max-height: 48px;
    object-fit: contain;
    object-position: left center;
  }
  .website {
    margin-top: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .3px;
  }
  .order-type {
    flex: 0 0 auto;
    border: 2px solid #111;
    padding: 7px 10px;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: .5px;
  }
  .section {
    margin-top: 13px;
    padding-top: 10px;
    border-top: 2px solid #111;
  }
  .heading {
    margin-bottom: 7px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .customer-name {
    margin-bottom: 7px;
    font-size: 19px;
    line-height: 1.15;
    font-weight: 900;
  }
  .address { font-size: 12px; line-height: 1.5; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 11px;
  }
  td {
    padding: 7px 3px;
    border-bottom: 1px solid #aaa;
    vertical-align: top;
  }
  .product { overflow-wrap: anywhere; }
  .product strong {
    display: block;
    font-size: 11px;
    line-height: 1.3;
  }
  .product small {
    display: block;
    margin-top: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .qty {
    width: 42px;
    text-align: right;
    font-size: 12px;
    font-weight: 900;
  }
  .empty { padding: 10px 3px; font-size: 11px; }
  .footer {
    display: flex;
    justify-content: center;
    margin-top: 16px;
    padding-top: 9px;
    border-top: 1px dashed #555;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .4px;
  }
  @media screen {
    body { padding: 12px; background: #eee; }
    .label {
      margin: 0 auto;
      box-shadow: 0 2px 10px #bbb;
    }
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

    <footer class="footer">anjivo.online</footer>
  </article>

  <script>
    window.onload = () => {
      const logo = document.querySelector(".logo");
      const printWhenReady = () => setTimeout(() => window.print(), 250);
      if (logo && !logo.complete) {
        logo.onload = printWhenReady;
        logo.onerror = printWhenReady;
      } else {
        printWhenReady();
      }
    };
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=520,height=760");

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
