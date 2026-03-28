import { Module } from '@nestjs/common';

import { ComparisonModule } from './comparison/comparison.module';

@Module({
  imports: [ComparisonModule],
})
export class AppModule {}
