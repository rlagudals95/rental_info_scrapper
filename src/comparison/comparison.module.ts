import { Module } from '@nestjs/common';

import { ComparisonController } from './comparison.controller';
import { COMPARISON_REPOSITORY } from './comparison.repository';
import { ComparisonService } from './comparison.service';
import { InMemoryComparisonRepository } from './in-memory-comparison.repository';

@Module({
  controllers: [ComparisonController],
  providers: [
    ComparisonService,
    InMemoryComparisonRepository,
    {
      provide: COMPARISON_REPOSITORY,
      useExisting: InMemoryComparisonRepository,
    },
  ],
})
export class ComparisonModule {}
