import fs from 'node:fs';
import path from 'node:path';

interface OfferRow {
  channel: string;
  external_product_id: string;
  product_name: string;
  has_affiliate_card: string;
  primary_card_company: string;
  primary_card_name: string;
  contract_term_months: string;
  public_monthly_fee: string;
  support_pricing_model: string;
  support_amount: string;
  support_amount_min: string;
  support_amount_max: string;
}

type Channel = 'ajd' | 'miso' | 'rentre';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(content: string): OfferRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const rows: OfferRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]);
    const raw = Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ''])) as Record<
      string,
      string
    >;

    rows.push({
      channel: raw.channel ?? '',
      external_product_id: raw.external_product_id ?? '',
      product_name: raw.product_name ?? '',
      has_affiliate_card: raw.has_affiliate_card ?? '',
      primary_card_company: raw.primary_card_company ?? '',
      primary_card_name: raw.primary_card_name ?? '',
      contract_term_months: raw.contract_term_months ?? '',
      public_monthly_fee: raw.public_monthly_fee ?? '',
      support_pricing_model: raw.support_pricing_model ?? '',
      support_amount: raw.support_amount ?? '',
      support_amount_min: raw.support_amount_min ?? '',
      support_amount_max: raw.support_amount_max ?? '',
    });
  }

  return rows;
}

function supportSignature(row: OfferRow): string {
  return [
    row.support_pricing_model || 'null',
    row.support_amount || 'null',
    row.support_amount_min || 'null',
    row.support_amount_max || 'null',
  ].join(':');
}

function summarizeChannel(rows: OfferRow[], channel: Channel): { ok: boolean; lines: string[] } {
  const channelRows = rows.filter((row) => row.channel === channel);
  const byProduct = new Map<string, OfferRow[]>();

  for (const row of channelRows) {
    const current = byProduct.get(row.external_product_id) ?? [];
    current.push(row);
    byProduct.set(row.external_product_id, current);
  }

  let productsWithMultiTerms = 0;
  let productsWithTermFeeVariance = 0;
  let productsWithTermSupportVariance = 0;
  let offersWithAffiliateCard = 0;
  let offersWithPrimaryCardCompany = 0;
  let offersWithPrimaryCardName = 0;
  const suspiciousProducts: Array<{ productId: string; name: string; terms: string[] }> = [];

  channelRows.forEach((row) => {
    if (row.has_affiliate_card !== 'true') {
      return;
    }

    offersWithAffiliateCard += 1;

    if (row.primary_card_company.length > 0) {
      offersWithPrimaryCardCompany += 1;
    }

    if (row.primary_card_name.length > 0) {
      offersWithPrimaryCardName += 1;
    }
  });

  for (const [productId, productRows] of byProduct.entries()) {
    const terms = Array.from(
      new Set(productRows.map((row) => row.contract_term_months).filter((term) => term.length > 0)),
    );

    if (terms.length < 2) {
      continue;
    }

    productsWithMultiTerms += 1;

    const feeByTerm = new Map<string, Set<string>>();
    const supportByTerm = new Map<string, Set<string>>();

    for (const row of productRows) {
      const term = row.contract_term_months;
      if (!term) {
        continue;
      }

      const feeSet = feeByTerm.get(term) ?? new Set<string>();
      feeSet.add(row.public_monthly_fee || 'null');
      feeByTerm.set(term, feeSet);

      const supportSet = supportByTerm.get(term) ?? new Set<string>();
      supportSet.add(supportSignature(row));
      supportByTerm.set(term, supportSet);
    }

    const allFees = new Set(Array.from(feeByTerm.values()).flatMap((set) => Array.from(set)));
    const allSupportSignatures = new Set(
      Array.from(supportByTerm.values()).flatMap((set) => Array.from(set)),
    );

    if (allFees.size >= 2) {
      productsWithTermFeeVariance += 1;
    } else {
      suspiciousProducts.push({
        productId,
        name: productRows[0]?.product_name ?? '',
        terms,
      });
    }

    if (allSupportSignatures.size >= 2) {
      productsWithTermSupportVariance += 1;
    }
  }

  const lines = [
    `- ${channel}: products=${byProduct.size}, multi_terms=${productsWithMultiTerms}, term_fee_variance=${productsWithTermFeeVariance}, term_support_variance=${productsWithTermSupportVariance}`,
    `  card_metadata: has_card=${offersWithAffiliateCard}, company_filled=${offersWithPrimaryCardCompany}, name_filled=${offersWithPrimaryCardName}`,
  ];

  if (
    offersWithAffiliateCard > 0 &&
    (offersWithPrimaryCardCompany < offersWithAffiliateCard ||
      offersWithPrimaryCardName < offersWithAffiliateCard)
  ) {
    lines.push(
      `  ⚠️ 카드할인 오퍼 중 카드사/카드명 누락 ${offersWithAffiliateCard - offersWithPrimaryCardCompany}/${offersWithAffiliateCard - offersWithPrimaryCardName}`,
    );
  }

  if (suspiciousProducts.length > 0) {
    lines.push(
      `  ⚠️ term은 여러 개인데 월요금이 동일한 상품 ${suspiciousProducts.length}개 (상위 5개):`,
    );

    for (const item of suspiciousProducts.slice(0, 5)) {
      lines.push(`    - ${item.productId} | ${item.name} | terms=${item.terms.join('/')}`);
    }
  }

  return {
    ok: true,
    lines,
  };
}

function main(): void {
  const csvPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(process.cwd(), 'exports/water-purifier/latest-offers.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    console.error(`No rows found in CSV: ${csvPath}`);
    process.exit(1);
  }

  console.log(`[validate] ${csvPath}`);

  const channels: Channel[] = ['ajd', 'miso', 'rentre'];
  for (const channel of channels) {
    const summary = summarizeChannel(rows, channel);
    summary.lines.forEach((line) => console.log(line));
  }

  console.log('\nValidation passed (warnings may exist for exceptional products).');
}

main();
