export type ProductStatus = 'active' | 'hidden' | 'discontinued';
export type ManagementType = 'visit' | 'self';
export type ChannelType =
  | 'official_mall'
  | 'comparison_market'
  | 'lead_market'
  | 'dealer';
export type SupportPricingModel =
  | 'fixed_public'
  | 'range_public'
  | 'quote_required'
  | 'hidden';
export type PayoutTiming =
  | 'same_day'
  | 'after_install'
  | 'after_confirmation'
  | 'delayed'
  | 'unknown';
export type PayoutMethod =
  | 'cash'
  | 'giftcard'
  | 'points'
  | 'product'
  | 'mixed'
  | 'unknown';
export type BenefitGuaranteeType = 'platform' | 'seller' | 'none' | 'unclear';
export type MatchingStatus =
  | 'unmatched'
  | 'auto_matched'
  | 'manually_matched'
  | 'low_confidence';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type OfferStatus = 'active' | 'expired' | 'hidden' | 'sold_out';
export type OwnershipEndType =
  | 'return'
  | 'transfer'
  | 'renewal_choice'
  | 'unknown';
export type BenefitType =
  | 'giftcard'
  | 'product_gift'
  | 'fee_waiver'
  | 'first_month_free'
  | 'bundle_discount'
  | 'other';
export type BenefitValueModel = 'fixed' | 'range' | 'hidden';
export type SourceType = 'page' | 'manual';
export type SortKey = 'lowestNonCardMonthlyFee' | 'effectiveCost12mMax';

export interface BrandRecord {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
}

export interface ProductRecord {
  id: string;
  brandId: string;
  categoryId: string;
  name: string;
  modelName: string;
  modelCode: string;
  officialProductUrl: string;
  cashPrice: number | null;
  status: ProductStatus;
  specifications: {
    hasIce: boolean;
    temperatureModes: string[];
    waterSourceType: 'direct_flow' | 'tank';
    installationType: 'countertop' | 'under_sink';
    widthMm: number;
    depthMm: number;
    heightMm: number;
  };
}

export interface RentalPlanRecord {
  id: string;
  productId: string;
  planName: string;
  managementType: ManagementType;
  contractTermMonths: number;
  obligationTermMonths: number;
  ownershipTransferMonths: number | null;
  baseMonthlyFee: number;
  promoMonthlyFee: number | null;
  totalContractCost: number;
  registrationFee: number;
  installationFee: number;
  visitCycleMonths: number | null;
  filterCycleMonths: number | null;
  careSummary: string;
  officialCardDiscountAmount: number | null;
  officialCardRequiredSpendAmount: number | null;
  officialCardSummary: string | null;
  isActive: boolean;
}

export interface ContractPolicyRecord {
  id: string;
  rentalPlanId: string;
  earlyTerminationAllowed: boolean;
  penaltySummary: string;
  pickupFee: number | null;
  ownershipEndType: OwnershipEndType;
  notes: string | null;
}

export interface SalesChannelRecord {
  id: string;
  slug: string;
  name: string;
  channelType: ChannelType;
  websiteUrl: string;
}

export interface ChannelOfferRecord {
  id: string;
  salesChannelId: string;
  productId: string;
  rentalPlanId: string;
  offerName: string;
  publicOfferUrl: string;
  publicMonthlyFee: number | null;
  nonCardMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  payoutTiming: PayoutTiming;
  payoutMethod: PayoutMethod;
  installDayPayout: boolean;
  benefitGuaranteeType: BenefitGuaranteeType;
  matchingStatus: MatchingStatus;
  matchingConfidence: number;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  status: OfferStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
}

export interface OfferBenefitRecord {
  id: string;
  channelOfferId: string;
  benefitType: BenefitType;
  valueModel: BenefitValueModel;
  amount: number | null;
  amountMin: number | null;
  amountMax: number | null;
  description: string;
  conditions: string | null;
  payoutTiming: PayoutTiming;
  payoutMethod: PayoutMethod;
  sourceType: SourceType;
  isActive: boolean;
}

export interface ComparisonDataset {
  brands: BrandRecord[];
  categories: CategoryRecord[];
  products: ProductRecord[];
  rentalPlans: RentalPlanRecord[];
  contractPolicies: ContractPolicyRecord[];
  salesChannels: SalesChannelRecord[];
  channelOffers: ChannelOfferRecord[];
  offerBenefits: OfferBenefitRecord[];
}

export interface ComparisonListQuery {
  brand?: string;
  managementType?: ManagementType;
  contractTermMonths?: number;
  hasIce?: boolean;
  maxNonCardMonthlyFee?: number;
  supportPricingModel?: SupportPricingModel;
  sort: SortKey;
}

export interface OfferCostSummary {
  monthlyBurden12m: number;
  effectiveCost12mMin: number;
  effectiveCost12mMax: number;
}

export interface ComparisonListItem {
  productId: string;
  brandName: string;
  productName: string;
  modelName: string;
  managementType: ManagementType;
  contractTermMonths: number;
  officialMonthlyFee: number;
  lowestNonCardMonthlyFee: number;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  effectiveCost12mMin: number;
  effectiveCost12mMax: number;
  offerCount: number;
}

export interface ComparisonOfferDetail {
  offerId: string;
  channelName: string;
  offerName: string;
  publicOfferUrl: string;
  nonCardMonthlyFee: number | null;
  cardAppliedMonthlyFee: number | null;
  supportPricingModel: SupportPricingModel;
  supportAmount: number | null;
  supportAmountMin: number | null;
  supportAmountMax: number | null;
  payoutTiming: PayoutTiming;
  payoutMethod: PayoutMethod;
  installDayPayout: boolean;
  benefitGuaranteeType: BenefitGuaranteeType;
  effectiveCost12mMin: number;
  effectiveCost12mMax: number;
  contractSummary: {
    contractTermMonths: number;
    managementType: ManagementType;
    ownershipTransferMonths: number | null;
    careSummary: string;
    penaltySummary: string;
    pickupFee: number | null;
    ownershipEndType: OwnershipEndType;
  };
  benefits: Array<{
    benefitType: BenefitType;
    valueModel: BenefitValueModel;
    amount: number | null;
    amountMin: number | null;
    amountMax: number | null;
    description: string;
  }>;
}

export interface ComparisonProductDetail {
  productId: string;
  brandName: string;
  productName: string;
  modelName: string;
  modelCode: string;
  officialProductUrl: string;
  cashPrice: number | null;
  specifications: ProductRecord['specifications'];
  officialPlans: Array<{
    planId: string;
    planName: string;
    managementType: ManagementType;
    contractTermMonths: number;
    officialMonthlyFee: number;
    promoMonthlyFee: number | null;
    totalContractCost: number;
    visitCycleMonths: number | null;
    filterCycleMonths: number | null;
    careSummary: string;
    officialCardDiscountAmount: number | null;
    officialCardRequiredSpendAmount: number | null;
    officialCardSummary: string | null;
    contractPolicy: {
      earlyTerminationAllowed: boolean;
      penaltySummary: string;
      pickupFee: number | null;
      ownershipEndType: OwnershipEndType;
      notes: string | null;
    };
  }>;
  offers: ComparisonOfferDetail[];
}
