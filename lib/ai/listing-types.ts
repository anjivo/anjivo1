
/**
 * ANJIVO AI Listing Studio — Advanced Shared Types
 * File: lib/ai/listing-types.ts
 *
 * Shared types for:
 * - AI single product listing
 * - AI bulk listing and batch processing
 * - AI SEO and keyword generation
 * - AI product attributes and category mapping
 * - AI image studio and image review
 * - Product variants and inventory
 * - AI pricing suggestions
 * - Seller/Admin moderation and approval
 * - Marketplace export
 * - AI jobs, usage tracking, errors and audit logs
 *
 * Important:
 * AI-generated data is always a suggestion.
 * Seller/admin confirmation is required before publishing
 * product information, stock, prices and compliance details.
 */

/* =========================================================
   1. COMMON TYPES
========================================================= */

export type ListingRole = "seller" | "admin";

export type ListingStatus =
  | "draft"
  | "processing"
  | "needs_review"
  | "pending_approval"
  | "approved"
  | "published"
  | "rejected"
  | "failed"
  | "archived";

export type AIConfidenceLevel =
  | "low"
  | "medium"
  | "high";

export type AIReviewDecision =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export type AIJobPriority =
  | "low"
  | "normal"
  | "high";

export type AIJobType =
  | "generate_listing"
  | "bulk_generate"
  | "generate_images"
  | "enhance_image"
  | "generate_seo"
  | "generate_attributes"
  | "pricing_assistance"
  | "catalog_import"
  | "marketplace_export";

/* =========================================================
   2. PRODUCT CATEGORY AND ATTRIBUTE TYPES
========================================================= */

export interface AIProductCategory {
  id?: string;

  name: string;

  slug?: string;

  parentId?: string | null;

  parentName?: string;

  level?: number;

  path?: string[];

  description?: string;

  isActive?: boolean;
}

export type AIAttributeValueType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date"
  | "measurement";

export interface AIProductAttributeDefinition {
  id: string;

  name: string;

  label: string;

  type: AIAttributeValueType;

  required: boolean;

  options?: string[];

  unit?: string;

  min?: number;

  max?: number;

  description?: string;

  categoryId?: string;

  marketplaceRequired?: boolean;
}

export interface AIProductAttributeValue {
  name: string;

  value: string | number | boolean | string[];

  unit?: string;

  source?: "seller" | "ai" | "catalog";

  confidence?: AIConfidenceLevel;

  isVerified?: boolean;

  verifiedBy?: string;

  verifiedAt?: string;
}

/* =========================================================
   3. IMAGE TYPES
========================================================= */

export type ImageView =
  | "front"
  | "back"
  | "left"
  | "right"
  | "detail"
  | "lifestyle"
  | "top"
  | "bottom"
  | "inside"
  | "packaging"
  | "size_chart"
  | "other";

export type ImageSource =
  | "original"
  | "enhanced"
  | "ai_generated"
  | "catalog"
  | "seller_uploaded";

export type ImageReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export type ImageGenerationScene =
  | "white_background"
  | "lifestyle"
  | "studio"
  | "festival"
  | "fashion"
  | "product_detail"
  | "marketplace"
  | "social_media"
  | "custom";

export type ImageGenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ImageFormat =
  | "jpg"
  | "jpeg"
  | "png"
  | "webp";

export interface AIProductImage {
  id: string;

  // Firebase Storage download URL
  url: string;

  // Original uploaded image URL
  originalUrl?: string;

  // Firebase Storage object path
  storagePath?: string;

  // Original uploaded image Storage path
  originalStoragePath?: string;

  view: ImageView;

  source: ImageSource;

  altText: string;

  reviewStatus: ImageReviewStatus;

  isPrimary: boolean;

  isAIGenerated: boolean;

  // Generation metadata
  generationId?: string;

  generationScene?: ImageGenerationScene;

  generationPrompt?: string;

  model?: string;

  // Image dimensions and format
  width?: number;

  height?: number;

  format?: ImageFormat;

  fileSizeBytes?: number;

  mimeType?: string;

  // Image ownership and verification
  sellerId?: string;

  uploadedBy?: string;

  verifiedOwnership?: boolean;

  // Moderation
  reviewReason?: string;

  reviewedBy?: string;

  reviewedAt?: string;

  // Compliance and authenticity
  containsWatermark?: boolean;

  containsText?: boolean;

  isActualProductImage?: boolean;

  // Timestamps
  createdAt?: string;

  updatedAt?: string;
}

export interface AIImageGenerationRequest {
  listingId?: string;

  sellerId: string;

  sourceImageUrls: string[];

  scene: ImageGenerationScene;

  customPrompt?: string;

  numberOfImages?: number;

  aspectRatio?: "1:1" | "4:5" | "3:4" | "16:9";

  background?: string;

  preserveProductAppearance?: boolean;

  removeBackground?: boolean;

  addText?: boolean;
}

export interface AIImageGenerationResponse {
  success: boolean;

  images?: AIProductImage[];

  generationId?: string;

  status?: ImageGenerationStatus;

  error?: string;

  warnings?: string[];
}

/* =========================================================
   4. PRODUCT VARIANTS AND INVENTORY
========================================================= */

export interface AIProductVariant {
  id: string;

  sku: string;

  barcode?: string;

  // Examples: Blue, Black, White
  color?: string;

  // Examples: S, M, L, XL, XXL
  size?: string;

  // Additional variant attributes
  attributes: Record<string, string>;

  // Variant-specific image URLs
  imageUrls: string[];

  // Actual stock must be seller-confirmed
  stockQuantity: number | null;

  // INR amounts
  sellingPrice: number | null;

  wholesalePrice: number | null;

  mrp: number | null;

  // Optional physical attributes
  weight?: number | null;

  length?: number | null;

  width?: number | null;

  height?: number | null;

  // Seller/admin confirmation
  isConfirmed: boolean;

  confirmedBy?: string;

  confirmedAt?: string;

  // Inventory management
  reservedQuantity?: number;

  availableQuantity?: number;

  lowStockThreshold?: number;

  inventoryStatus?: "in_stock" | "low_stock" | "out_of_stock";

  isActive?: boolean;

  createdAt?: string;

  updatedAt?: string;
}

export interface AIProductVariantOption {
  name: string;

  values: string[];

  required?: boolean;

  source?: "seller" | "ai";

  isVerified?: boolean;
}

/* =========================================================
   5. SEO TYPES
========================================================= */

export interface AIListingSEO {
  metaTitle: string;

  metaDescription: string;

  slug: string;

  primaryKeyword: string;

  secondaryKeywords: string[];

  searchTerms: string[];

  tags: string[];

  canonicalUrl?: string;

  seoScore?: number;

  suggestions?: string[];

  generatedAt?: string;

  isSellerConfirmed?: boolean;
}

export interface AISEOGenerateRequest {
  listingId?: string;

  title: string;

  description?: string;

  category?: string;

  brand?: string;

  keywords?: string[];

  marketplace?: MarketplaceName;

  language?: string;
}

export interface AISEOGenerateResponse {
  success: boolean;

  seo?: AIListingSEO;

  error?: string;

  warnings?: string[];
}

/* =========================================================
   6. PRICING ASSISTANT TYPES
========================================================= */

export type PricingStrategy =
  | "competitive"
  | "margin_based"
  | "wholesale"
  | "retail"
  | "premium"
  | "custom";

export interface AIPriceSuggestion {
  suggestedSellingPrice: number | null;

  suggestedWholesalePrice: number | null;

  suggestedMrp: number | null;

  estimatedCostPrice?: number | null;

  estimatedProfit?: number | null;

  estimatedMarginPercent?: number | null;

  estimatedMarketplaceFees?: number | null;

  estimatedShippingCost?: number | null;

  estimatedTaxAmount?: number | null;

  strategy?: PricingStrategy;

  currency: "INR";

  assumptions: string[];

  warnings: string[];

  confidence?: AIConfidenceLevel;

  source?: "seller_input" | "market_data" | "ai_estimate";

  generatedAt?: string;
}

export interface AIPricingRequest {
  listingId?: string;

  category: string;

  productName: string;

  costPrice?: number;

  targetMarginPercent?: number;

  estimatedShippingCost?: number;

  marketplaceFeesPercent?: number;

  gstRate?: number;

  strategy: PricingStrategy;

  currency?: "INR";
}

export interface AIPricingResponse {
  success: boolean;

  suggestion?: AIPriceSuggestion;

  error?: string;

  warnings?: string[];
}

/* =========================================================
   7. PRODUCT LISTING
========================================================= */

export interface AIProductListing {
  id?: string;

  sellerId: string;

  createdBy: string;

  createdByRole: ListingRole;

  // Product information
  title: string;

  slug: string;

  description: string;

  shortDescription: string;

  brand: string;

  category: string;

  subcategory: string;

  productType: string;

  highlights: string[];

  searchKeywords: string[];

  // Product specifications
  attributes: Record<string, string>;

  attributeValues?: AIProductAttributeValue[];

  categoryId?: string;

  categoryPath?: string[];

  // Images and variants
  images: AIProductImage[];

  variants: AIProductVariant[];

  variantOptions?: AIProductVariantOption[];

  // Main listing prices in INR
  sellingPrice: number | null;

  wholesalePrice: number | null;

  mrp: number | null;

  currency?: "INR";

  // Compliance details require verification
  hsnCode: string;

  gstRate: number | null;

  countryOfOrigin: string;

  manufacturerName?: string;

  manufacturerAddress?: string;

  importerName?: string;

  importerAddress?: string;

  packerName?: string;

  packerAddress?: string;

  // Physical details
  weight?: number | null;

  length?: number | null;

  width?: number | null;

  height?: number | null;

  packageWeight?: number | null;

  packageLength?: number | null;

  packageWidth?: number | null;

  packageHeight?: number | null;

  // Shipping
  shippingClass?: string;

  isReturnable?: boolean;

  returnWindowDays?: number | null;

  // SEO
  seo?: AIListingSEO;

  // Pricing suggestions
  pricingSuggestion?: AIPriceSuggestion;

  // AI metadata
  aiGenerated: boolean;

  aiModel?: string;

  aiGenerationId?: string;

  aiConfidence?: AIConfidenceLevel;

  aiWarnings?: string[];

  // Confirmation and approval
  status: ListingStatus;

  sellerConfirmed: boolean;

  adminApproved: boolean;

  sellerConfirmedAt?: string;

  sellerConfirmedBy?: string;

  adminApprovedAt?: string;

  adminApprovedBy?: string;

  rejectionReason?: string;

  reviewNotes?: string;

  // Marketplace publication
  publishedAt?: string;

  publishedBy?: string;

  marketplaceIds?: string[];

  // Ownership and timestamps
  createdAt?: string;

  updatedAt?: string;
}

/* =========================================================
   8. SINGLE LISTING GENERATION
========================================================= */

export interface AIListingGenerateRequest {
  images: string[];

  sellerId: string;

  role: ListingRole;

  // User-provided hints
  categoryHint?: string;

  brandHint?: string;

  productHint?: string;

  descriptionHint?: string;

  language?: string;

  // Suggested variant options
  variantHints?: {
    sizes?: string[];

    colors?: string[];

    attributes?: Record<string, string[]>;
  };

  // Optional generation preferences
  generateSEO?: boolean;

  generateAttributes?: boolean;

  generateHighlights?: boolean;

  generateKeywords?: boolean;

  generateVariants?: boolean;

  marketplace?: MarketplaceName;

  // Existing listing for enhancement
  existingListingId?: string;
}

export interface AIListingGenerateResponse {
  success: boolean;

  listing?: AIProductListing;

  error?: string;

  warnings?: string[];

  generationId?: string;

  processingTimeMs?: number;

  usage?: AIUsageMetrics;
}

/* =========================================================
   9. BULK LISTING AND JOBS
========================================================= */

export type BulkJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export interface AIBulkListingItem {
  id: string;

  imageUrls: string[];

  listing?: AIProductListing;

  status: ListingStatus;

  error?: string;

  warnings?: string[];

  retryCount?: number;

  sourceRowNumber?: number;

  sourceFileName?: string;

  startedAt?: string;

  completedAt?: string;
}

export interface AIBulkListingJob {
  id: string;

  sellerId: string;

  createdBy: string;

  createdByRole: ListingRole;

  items: AIBulkListingItem[];

  totalProducts: number;

  completedProducts: number;

  failedProducts: number;

  status: BulkJobStatus;

  priority?: AIJobPriority;

  progressPercent?: number;

  currentItemId?: string;

  error?: string;

  retryCount?: number;

  startedAt?: string;

  completedAt?: string;

  createdAt?: string;

  updatedAt?: string;
}

export interface AIBulkListingRequest {
  sellerId: string;

  role: ListingRole;

  products: Array<{
    id?: string;

    imageUrls: string[];

    productHint?: string;

    categoryHint?: string;

    brandHint?: string;

    sourceRowNumber?: number;
  }>;

  generateSEO?: boolean;

  generateAttributes?: boolean;

  generateVariants?: boolean;

  marketplace?: MarketplaceName;
}

export interface AIBulkListingResponse {
  success: boolean;

  job?: AIBulkListingJob;

  jobId?: string;

  error?: string;

  warnings?: string[];
}

/* =========================================================
   10. CATALOG AND CSV IMPORT
========================================================= */

export type CatalogImportStatus =
  | "uploaded"
  | "parsing"
  | "mapping"
  | "ready"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";

export interface AICatalogImportColumn {
  sourceColumn: string;

  targetField: string;

  confidence?: AIConfidenceLevel;

  isRequired?: boolean;

  isMapped: boolean;
}

export interface AICatalogImportRow {
  rowNumber: number;

  rawData: Record<string, string>;

  mappedData?: Partial<AIProductListing>;

  status: "pending" | "valid" | "invalid" | "imported";

  errors?: string[];

  warnings?: string[];
}

export interface AICatalogImportJob {
  id: string;

  sellerId: string;

  createdBy: string;

  fileName: string;

  fileUrl?: string;

  status: CatalogImportStatus;

  columns: AICatalogImportColumn[];

  totalRows: number;

  processedRows: number;

  successfulRows: number;

  failedRows: number;

  errors?: string[];

  warnings?: string[];

  createdAt?: string;

  updatedAt?: string;
}

/* =========================================================
   11. SELLER CONFIRMATION
========================================================= */

export interface AIListingConfirmation {
  listingId: string;

  confirmedBy: string;

  role: ListingRole;

  confirmedAt: string;

  confirmedFields: string[];

  approvedImageIds: string[];

  confirmedVariantIds: string[];

  submitForApproval: boolean;

  // Additional explicit confirmations
  confirmedPrice?: boolean;

  confirmedStock?: boolean;

  confirmedAttributes?: boolean;

  confirmedCompliance?: boolean;

  confirmedProductAuthenticity?: boolean;

  notes?: string;
}

/* =========================================================
   12. ADMIN MODERATION
========================================================= */

export interface AIListingReview {
  id?: string;

  listingId: string;

  sellerId: string;

  reviewedBy: string;

  reviewerRole: ListingRole;

  decision: AIReviewDecision;

  reason?: string;

  notes?: string;

  rejectedFields?: string[];

  approvedImageIds?: string[];

  rejectedImageIds?: string[];

  reviewedAt?: string;
}

export interface AIListingModerationQueue {
  listingId: string;

  sellerId: string;

  title: string;

  status: ListingStatus;

  submittedAt?: string;

  priority?: AIJobPriority;

  flaggedIssues?: string[];

  imageCount?: number;

  pendingImageCount?: number;

  sellerConfirmed: boolean;
}

/* =========================================================
   13. MARKETPLACE EXPORT
========================================================= */

export type MarketplaceName =
  | "anjivo"
  | "amazon"
  | "flipkart"
  | "meesho"
  | "myntra"
  | "shopify"
  | "custom";

export type MarketplaceExportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";

export interface AIMarketplaceFieldMapping {
  sourceField: string;

  targetField: string;

  required: boolean;

  isMapped: boolean;

  transformation?: string;
}

export interface AIMarketplaceExportJob {
  id: string;

  sellerId: string;

  listingIds: string[];

  marketplace: MarketplaceName;

  status: MarketplaceExportStatus;

  exportedCount: number;

  failedCount: number;

  errors?: string[];

  warnings?: string[];

  createdAt?: string;

  updatedAt?: string;
}

export interface AIMarketplaceExportResponse {
  success: boolean;

  job?: AIMarketplaceExportJob;

  exportedListings?: number;

  failedListings?: number;

  errors?: string[];

  warnings?: string[];
}

/* =========================================================
   14. GENERAL AI JOB MANAGEMENT
========================================================= */

export type AIJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export interface AIJob {
  id: string;

  sellerId: string;

  createdBy: string;

  createdByRole: ListingRole;

  type: AIJobType;

  status: AIJobStatus;

  priority: AIJobPriority;

  progressPercent: number;

  input?: Record<string, unknown>;

  result?: Record<string, unknown>;

  error?: string;

  retryCount: number;

  maxRetries?: number;

  startedAt?: string;

  completedAt?: string;

  createdAt?: string;

  updatedAt?: string;
}

export interface AIJobResponse {
  success: boolean;

  job?: AIJob;

  error?: string;
}

/* =========================================================
   15. AI USAGE AND COST TRACKING
========================================================= */

export interface AIUsageMetrics {
  provider?: string;

  model?: string;

  inputTokens?: number;

  outputTokens?: number;

  totalTokens?: number;

  imagesProcessed?: number;

  imagesGenerated?: number;

  estimatedCostINR?: number;

  durationMs?: number;
}

export interface AISellerUsage {
  sellerId: string;

  totalListingGenerations: number;

  totalImageGenerations: number;

  totalBulkJobs: number;

  totalTokens?: number;

  estimatedCostINR?: number;

  periodStart?: string;

  periodEnd?: string;

  updatedAt?: string;
}

/* =========================================================
   16. ERROR HANDLING
========================================================= */

export type AIErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_OWNERSHIP_FAILED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "AI_PROVIDER_ERROR"
  | "AI_RESPONSE_INVALID"
  | "VALIDATION_FAILED"
  | "PRODUCT_NOT_FOUND"
  | "JOB_NOT_FOUND"
  | "JOB_ALREADY_PROCESSED"
  | "STORAGE_ERROR"
  | "DATABASE_ERROR"
  | "MARKETPLACE_ERROR"
  | "COMPLIANCE_ERROR"
  | "UNKNOWN_ERROR";

export interface AIListingError {
  code: string;

  message: string;

  field?: string;

  retryable: boolean;

  details?: string;

  timestamp?: string;

  requestId?: string;
}

export interface AIErrorResponse {
  success: false;

  error: string;

  code?: AIErrorCode | string;

  details?: string;

  field?: string;

  retryable?: boolean;

  requestId?: string;
}

/* =========================================================
   17. AUDIT LOGS
========================================================= */

export type AIAuditAction =
  | "listing_generated"
  | "listing_updated"
  | "listing_confirmed"
  | "listing_submitted"
  | "listing_approved"
  | "listing_rejected"
  | "image_generated"
  | "image_approved"
  | "image_rejected"
  | "bulk_job_created"
  | "bulk_job_completed"
  | "catalog_imported"
  | "marketplace_exported";

export interface AIAuditLog {
  id: string;

  sellerId: string;

  listingId?: string;

  jobId?: string;

  performedBy: string;

  performedByRole: ListingRole;

  action: AIAuditAction;

  details?: Record<string, unknown>;

  createdAt?: string;
}

/* =========================================================
   18. VALIDATION TYPES
========================================================= */

export interface AIListingValidationIssue {
  field: string;

  code: string;

  message: string;

  severity: "error" | "warning" | "info";

  requiresSellerAction?: boolean;

  requiresAdminAction?: boolean;
}

export interface AIListingValidationResult {
  isValid: boolean;

  issues: AIListingValidationIssue[];

  errorCount: number;

  warningCount: number;

  validatedAt?: string;
}

/* =========================================================
   19. GENERIC API RESPONSE
========================================================= */

export interface AIListingAPIResponse<T> {
  success: boolean;

  data?: T;

  error?: string;

  code?: string;

  warnings?: string[];

  requestId?: string;
}
