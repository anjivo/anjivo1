# ANJIVO – Return & Refund Implementation Notes

## 1. Return Policy

- Customer can submit a return request within **72 hours (3 days)** after delivery.
- Return requests are subject to admin review and approval.
- Product inspection/QC may be required before refund approval.
- A submitted request does not guarantee approval.

## 2. Customer Return Workflow

1. Customer opens Account → Orders.
2. Customer selects an eligible delivered order.
3. Customer selects the product, quantity and return reason.
4. Customer adds a description and supporting images, where applicable.
5. Customer submits the return request.
6. Customer can view the request through the order details page.

### Supported return reasons

- Damaged item
- Wrong item
- Missing item
- Quality issue
- Size issue
- Not as described
- Other

## 3. Admin Return Workflow

Expected workflow:

`Request → Approval → Pickup → Received → QC → Refund Approval → Refund Initiation → Provider Confirmation → Completed`

Admin responsibilities:

- Review customer return details.
- Approve or reject requests.
- Manage pickup and received status.
- Record QC results.
- Approve eligible refunds.
- Initiate online refunds through Cashfree.
- Review refund status and provider confirmation.
- Handle disputes and maintain audit history.

## 4. API Routes

| API route | Purpose |
|---|---|
| `GET /api/returns` | Fetch customer return requests |
| `POST /api/returns` | Create a return request |
| `GET /api/admin/returns` | Fetch admin return records |
| `PATCH /api/admin/returns` | Update permitted return/refund statuses |
| `POST /api/admin/returns/refund` | Initiate or sync Cashfree refunds |

### Authentication

- Customer routes use Firebase bearer-token authentication.
- Customer ownership of the order must be verified.
- Admin routes require admin/superadmin authorization or an authorized admin custom claim.

## 5. Refund Rules

### Online payments

- Eligible online refunds are processed through Cashfree.
- Refund initiation and provider confirmation are separate steps.
- A refund must not be marked completed manually.
- Final completion must depend on confirmed provider status.

### Cash on Delivery (COD)

- COD refunds are not supported by the current Cashfree refund integration.
- For an approved COD refund, verified bank or another permitted refund method may be required.
- COD refund handling needs a separately implemented and verified workflow.

## 6. Environment Variables

Required for Cashfree integration:

- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`
- `CASHFREE_ENV`

Keep secret values only in server-side environment variables. Never expose them through `NEXT_PUBLIC_` variables or client-side code.

## 7. Security Checklist

- Verify Firebase authentication on customer APIs.
- Verify order ownership before creating a return.
- Verify admin authorization on admin APIs.
- Validate return quantity against order item quantity.
- Prevent duplicate return requests for the same eligible item.
- Enforce the 72-hour return window on the server.
- Do not trust refund amounts supplied by the browser.
- Record admin actions in audit logs.
- Do not expose payment credentials in API responses or browser code.

## 8. Testing Checklist

### Customer

- [ ] Unauthenticated customer cannot submit a return.
- [ ] Customer cannot return another customer's order.
- [ ] Return request works within 72 hours.
- [ ] Return request is blocked after 72 hours.
- [ ] Return request is blocked when delivery date is missing.
- [ ] Invalid quantity is rejected.
- [ ] Duplicate return request is handled correctly.
- [ ] Existing return request is visible in order details.

### Admin

- [ ] Non-admin cannot access admin return APIs.
- [ ] Admin can view return requests.
- [ ] Admin can approve or reject a request.
- [ ] Pickup and received statuses work correctly.
- [ ] QC pass/fail workflow works.
- [ ] Refund approval requires successful QC.
- [ ] Manual refund completion is blocked.
- [ ] Dispute and audit-log functionality works.

### Cashfree

- [ ] Test credentials and environment are configured.
- [ ] Eligible online payment refund can be initiated.
- [ ] Refund status can be synchronized.
- [ ] Provider-confirmed success updates the final status.
- [ ] Failed or pending refunds do not show as completed.
- [ ] COD refund is not incorrectly sent to Cashfree.
