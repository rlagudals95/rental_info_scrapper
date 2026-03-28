import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  calculateOfferEffectiveCost12m,
  compareOffersBySort,
} from './comparison-calculator';
import { COMPARISON_REPOSITORY, ComparisonRepository } from './comparison.repository';
import {
  ChannelOfferRecord,
  ComparisonListItem,
  ComparisonListQuery,
  ComparisonOfferDetail,
  ComparisonProductDetail,
  ContractPolicyRecord,
  OfferBenefitRecord,
  ProductRecord,
  RentalPlanRecord,
  SortKey,
} from './comparison.types';

@Injectable()
export class ComparisonService {
  constructor(
    @Inject(COMPARISON_REPOSITORY)
    private readonly comparisonRepository: ComparisonRepository,
  ) {}

  async listWaterPurifiers(query: ComparisonListQuery): Promise<ComparisonListItem[]> {
    const dataset = await this.comparisonRepository.loadDataset();
    const waterPurifierCategory = dataset.categories.find(
      (category) => category.slug === 'water-purifier',
    );

    if (!waterPurifierCategory) {
      return [];
    }

    const brandsById = new Map(dataset.brands.map((brand) => [brand.id, brand]));
    const plansById = new Map(dataset.rentalPlans.map((plan) => [plan.id, plan]));
    const products = dataset.products.filter(
      (product) =>
        product.categoryId === waterPurifierCategory.id && product.status === 'active',
    );

    const items = products
      .filter((product) => this.matchesProductFilters(product, brandsById.get(product.brandId)?.slug, query))
      .map((product) => this.buildListItem(product, plansById, dataset.channelOffers, brandsById, query))
      .filter((item): item is ComparisonListItem => item !== null);

    return items.sort((left, right) => this.compareListItems(left, right, query.sort));
  }

  async getWaterPurifierDetail(productId: string): Promise<ComparisonProductDetail> {
    const dataset = await this.comparisonRepository.loadDataset();
    const product = dataset.products.find(
      (candidate) =>
        candidate.id === productId &&
        candidate.status === 'active' &&
        dataset.categories.some(
          (category) =>
            category.id === candidate.categoryId && category.slug === 'water-purifier',
        ),
    );

    if (!product) {
      throw new NotFoundException(`Water purifier product ${productId} was not found`);
    }

    const brand = dataset.brands.find((candidate) => candidate.id === product.brandId);
    if (!brand) {
      throw new NotFoundException(`Brand for product ${productId} was not found`);
    }

    const plans = dataset.rentalPlans
      .filter((plan) => plan.productId === product.id && plan.isActive)
      .sort((left, right) => {
        if (left.contractTermMonths !== right.contractTermMonths) {
          return left.contractTermMonths - right.contractTermMonths;
        }

        return left.planName.localeCompare(right.planName);
      });

    const contractPoliciesByPlanId = new Map(
      dataset.contractPolicies.map((policy) => [policy.rentalPlanId, policy]),
    );
    const channelsById = new Map(dataset.salesChannels.map((channel) => [channel.id, channel]));
    const offerBenefitsByOfferId = dataset.offerBenefits.reduce<Map<string, OfferBenefitRecord[]>>(
      (map, benefit) => {
        if (!benefit.isActive) {
          return map;
        }

        const current = map.get(benefit.channelOfferId) ?? [];
        current.push(benefit);
        map.set(benefit.channelOfferId, current);
        return map;
      },
      new Map(),
    );

    const approvedOffers = dataset.channelOffers
      .filter(
        (offer) =>
          offer.productId === product.id &&
          offer.status === 'active' &&
          offer.reviewStatus === 'approved',
      )
      .sort((left, right) => compareOffersBySort(left, right, 'lowestNonCardMonthlyFee'));

    const offers: ComparisonOfferDetail[] = approvedOffers.map((offer) => {
      const plan = plans.find((candidate) => candidate.id === offer.rentalPlanId);
      if (!plan) {
        throw new NotFoundException(`Matched plan for offer ${offer.id} was not found`);
      }

      const contractPolicy = contractPoliciesByPlanId.get(plan.id);
      if (!contractPolicy) {
        throw new NotFoundException(`Contract policy for plan ${plan.id} was not found`);
      }

      const channel = channelsById.get(offer.salesChannelId);
      if (!channel) {
        throw new NotFoundException(`Sales channel for offer ${offer.id} was not found`);
      }

      const cost = calculateOfferEffectiveCost12m(offer);

      return {
        offerId: offer.id,
        channelName: channel.name,
        offerName: offer.offerName,
        publicOfferUrl: offer.publicOfferUrl,
        nonCardMonthlyFee: offer.nonCardMonthlyFee,
        cardAppliedMonthlyFee: offer.cardAppliedMonthlyFee,
        supportPricingModel: offer.supportPricingModel,
        supportAmount: offer.supportAmount,
        supportAmountMin: offer.supportAmountMin,
        supportAmountMax: offer.supportAmountMax,
        payoutTiming: offer.payoutTiming,
        payoutMethod: offer.payoutMethod,
        installDayPayout: offer.installDayPayout,
        benefitGuaranteeType: offer.benefitGuaranteeType,
        effectiveCost12mMin: cost.effectiveCost12mMin,
        effectiveCost12mMax: cost.effectiveCost12mMax,
        contractSummary: {
          contractTermMonths: plan.contractTermMonths,
          managementType: plan.managementType,
          ownershipTransferMonths: plan.ownershipTransferMonths,
          careSummary: plan.careSummary,
          penaltySummary: contractPolicy.penaltySummary,
          pickupFee: contractPolicy.pickupFee,
          ownershipEndType: contractPolicy.ownershipEndType,
        },
        benefits: (offerBenefitsByOfferId.get(offer.id) ?? []).map((benefit) => ({
          benefitType: benefit.benefitType,
          valueModel: benefit.valueModel,
          amount: benefit.amount,
          amountMin: benefit.amountMin,
          amountMax: benefit.amountMax,
          description: benefit.description,
        })),
      };
    });

    return {
      productId: product.id,
      brandName: brand.name,
      productName: product.name,
      modelName: product.modelName,
      modelCode: product.modelCode,
      officialProductUrl: product.officialProductUrl,
      cashPrice: product.cashPrice,
      specifications: product.specifications,
      officialPlans: plans.map((plan) => {
        const contractPolicy = contractPoliciesByPlanId.get(plan.id);
        if (!contractPolicy) {
          throw new NotFoundException(`Contract policy for plan ${plan.id} was not found`);
        }

        return {
          planId: plan.id,
          planName: plan.planName,
          managementType: plan.managementType,
          contractTermMonths: plan.contractTermMonths,
          officialMonthlyFee: plan.baseMonthlyFee,
          promoMonthlyFee: plan.promoMonthlyFee,
          totalContractCost: plan.totalContractCost,
          visitCycleMonths: plan.visitCycleMonths,
          filterCycleMonths: plan.filterCycleMonths,
          careSummary: plan.careSummary,
          officialCardDiscountAmount: plan.officialCardDiscountAmount,
          officialCardRequiredSpendAmount: plan.officialCardRequiredSpendAmount,
          officialCardSummary: plan.officialCardSummary,
          contractPolicy: {
            earlyTerminationAllowed: contractPolicy.earlyTerminationAllowed,
            penaltySummary: contractPolicy.penaltySummary,
            pickupFee: contractPolicy.pickupFee,
            ownershipEndType: contractPolicy.ownershipEndType,
            notes: contractPolicy.notes,
          },
        };
      }),
      offers,
    };
  }

  private matchesProductFilters(
    product: ProductRecord,
    brandSlug: string | undefined,
    query: ComparisonListQuery,
  ): boolean {
    if (query.brand && brandSlug !== query.brand) {
      return false;
    }

    if (query.hasIce !== undefined && product.specifications.hasIce !== query.hasIce) {
      return false;
    }

    return true;
  }

  private buildListItem(
    product: ProductRecord,
    plansById: Map<string, RentalPlanRecord>,
    offers: ChannelOfferRecord[],
    brandsById: Map<string, { name: string }>,
    query: ComparisonListQuery,
  ): ComparisonListItem | null {
    const brand = brandsById.get(product.brandId);
    if (!brand) {
      return null;
    }

    const filteredOffers = offers.filter((offer) => {
      if (offer.productId !== product.id) {
        return false;
      }

      if (offer.status !== 'active' || offer.reviewStatus !== 'approved') {
        return false;
      }

      if (
        query.maxNonCardMonthlyFee !== undefined &&
        (offer.nonCardMonthlyFee ?? Number.MAX_SAFE_INTEGER) > query.maxNonCardMonthlyFee
      ) {
        return false;
      }

      if (
        query.supportPricingModel !== undefined &&
        offer.supportPricingModel !== query.supportPricingModel
      ) {
        return false;
      }

      const plan = plansById.get(offer.rentalPlanId);
      if (!plan || !plan.isActive) {
        return false;
      }

      if (
        query.managementType !== undefined &&
        plan.managementType !== query.managementType
      ) {
        return false;
      }

      if (
        query.contractTermMonths !== undefined &&
        plan.contractTermMonths !== query.contractTermMonths
      ) {
        return false;
      }

      return true;
    });

    if (filteredOffers.length === 0) {
      return null;
    }

    const bestOffer = filteredOffers
      .slice()
      .sort((left, right) => compareOffersBySort(left, right, query.sort))[0];
    const plan = plansById.get(bestOffer.rentalPlanId);

    if (!plan) {
      return null;
    }

    const cost = calculateOfferEffectiveCost12m(bestOffer);

    return {
      productId: product.id,
      brandName: brand.name,
      productName: product.name,
      modelName: product.modelName,
      managementType: plan.managementType,
      contractTermMonths: plan.contractTermMonths,
      officialMonthlyFee: plan.baseMonthlyFee,
      lowestNonCardMonthlyFee: bestOffer.nonCardMonthlyFee ?? bestOffer.publicMonthlyFee ?? 0,
      supportPricingModel: bestOffer.supportPricingModel,
      supportAmount: bestOffer.supportAmount,
      supportAmountMin: bestOffer.supportAmountMin,
      supportAmountMax: bestOffer.supportAmountMax,
      effectiveCost12mMin: cost.effectiveCost12mMin,
      effectiveCost12mMax: cost.effectiveCost12mMax,
      offerCount: filteredOffers.length,
    };
  }

  private compareListItems(
    left: ComparisonListItem,
    right: ComparisonListItem,
    sort: SortKey,
  ): number {
    if (sort === 'effectiveCost12mMax') {
      if (left.effectiveCost12mMax !== right.effectiveCost12mMax) {
        return left.effectiveCost12mMax - right.effectiveCost12mMax;
      }
    }

    if (left.lowestNonCardMonthlyFee !== right.lowestNonCardMonthlyFee) {
      return left.lowestNonCardMonthlyFee - right.lowestNonCardMonthlyFee;
    }

    if (left.effectiveCost12mMax !== right.effectiveCost12mMax) {
      return left.effectiveCost12mMax - right.effectiveCost12mMax;
    }

    return left.productId.localeCompare(right.productId);
  }
}
