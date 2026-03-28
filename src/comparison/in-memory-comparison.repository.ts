import { Injectable } from '@nestjs/common';

import { ComparisonRepository } from './comparison.repository';
import { ComparisonDataset } from './comparison.types';
import { mvpWaterPurifierDataset } from './mvp-water-purifier.fixture';

@Injectable()
export class InMemoryComparisonRepository implements ComparisonRepository {
  async loadDataset(): Promise<ComparisonDataset> {
    return mvpWaterPurifierDataset;
  }
}
