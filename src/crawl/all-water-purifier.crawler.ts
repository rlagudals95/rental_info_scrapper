import {
  AjdWaterPurifierCatalog,
  crawlAjdWaterPurifierCatalog,
} from './ajd-water-purifier.crawler';
import {
  crawlMisoWaterPurifierCatalog,
  MisoWaterPurifierCatalog,
} from './miso-water-purifier.crawler';
import {
  crawlRentreWaterPurifierCatalog,
  RentreWaterPurifierCatalog,
} from './rentre-water-purifier.crawler';

type FetchLike = typeof fetch;

export interface AllWaterPurifierCatalogs {
  ajd: AjdWaterPurifierCatalog;
  miso: MisoWaterPurifierCatalog;
  rentre: RentreWaterPurifierCatalog;
}

export interface AllWaterPurifierCrawlResult {
  fetchedAt: string;
  channels: AllWaterPurifierCatalogs;
  summary: {
    totalProducts: number;
    totalOffers: number;
    channelProductCounts: Record<'ajd' | 'miso' | 'rentre', number>;
    channelOfferCounts: Record<'ajd' | 'miso' | 'rentre', number>;
  };
}

export async function crawlAllWaterPurifierCatalogs(
  fetchImpl: FetchLike = fetch,
): Promise<AllWaterPurifierCrawlResult> {
  const [ajd, miso, rentre] = await Promise.all([
    crawlAjdWaterPurifierCatalog(fetchImpl),
    crawlMisoWaterPurifierCatalog(fetchImpl),
    crawlRentreWaterPurifierCatalog(fetchImpl),
  ]);

  const channels = {
    ajd,
    miso,
    rentre,
  };

  return {
    fetchedAt: new Date().toISOString(),
    channels,
    summary: {
      totalProducts: ajd.productsCount + miso.productsCount + rentre.productsCount,
      totalOffers: ajd.offersCount + miso.offersCount + rentre.offersCount,
      channelProductCounts: {
        ajd: ajd.productsCount,
        miso: miso.productsCount,
        rentre: rentre.productsCount,
      },
      channelOfferCounts: {
        ajd: ajd.offersCount,
        miso: miso.offersCount,
        rentre: rentre.offersCount,
      },
    },
  };
}

async function main(): Promise<void> {
  const result = await crawlAllWaterPurifierCatalogs();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  void main();
}
