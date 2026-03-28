import { Controller, Get, Param, Query } from '@nestjs/common';

import { parseComparisonListQuery } from './comparison.query';
import { ComparisonService } from './comparison.service';

@Controller('comparison')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Get('water-purifiers')
  async listWaterPurifiers(
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.comparisonService.listWaterPurifiers(parseComparisonListQuery(query));
  }

  @Get('water-purifiers/:productId')
  async getWaterPurifierDetail(@Param('productId') productId: string) {
    return this.comparisonService.getWaterPurifierDetail(productId);
  }
}
