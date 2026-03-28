import { ComparisonDataset } from './comparison.types';

export const COMPARISON_REPOSITORY = Symbol('COMPARISON_REPOSITORY');

export interface ComparisonRepository {
  loadDataset(): Promise<ComparisonDataset>;
}
