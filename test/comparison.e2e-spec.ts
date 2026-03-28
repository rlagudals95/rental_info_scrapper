import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('ComparisonController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns default water purifier comparisons sorted by lowest non-card monthly fee', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparison/water-purifiers')
      .expect(200);

    expect(response.body).toHaveLength(3);
    expect(response.body[0]).toMatchObject({
      productId: 'product-cuckoo-slim-coldhot',
      lowestNonCardMonthlyFee: 23900,
      supportPricingModel: 'hidden',
    });
  });

  it('changes best-offer selection when sorting by effectiveCost12mMax', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparison/water-purifiers?sort=effectiveCost12mMax')
      .expect(200);

    expect(response.body[0]).toMatchObject({
      productId: 'product-lg-objet-ice',
      supportPricingModel: 'fixed_public',
      supportAmount: 180000,
      effectiveCost12mMax: 262800,
    });
  });

  it('filters by support pricing model', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparison/water-purifiers?supportPricingModel=range_public')
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.every((item: { supportPricingModel: string }) => item.supportPricingModel === 'range_public')).toBe(true);
  });

  it('returns product detail with approved offers only', async () => {
    const response = await request(app.getHttpServer())
      .get('/comparison/water-purifiers/product-coway-icon-ice')
      .expect(200);

    expect(response.body.productId).toBe('product-coway-icon-ice');
    expect(response.body.offers).toHaveLength(4);
    expect(
      response.body.offers.some(
        (offer: { publicOfferUrl: string }) =>
          offer.publicOfferUrl ===
          'https://miso.kr/booking/rental/water_purifier/WD526A?brand=coway',
      ),
    ).toBe(false);
  });
});
