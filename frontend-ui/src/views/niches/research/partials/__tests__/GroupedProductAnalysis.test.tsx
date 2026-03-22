import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../utils/test-utils';
import { GroupedProductAnalysis } from '../GroupedProductAnalysis';
import collectedItemsReducer from '../../../../../store/collectedItemsSlice';
import type { ResearchProduct } from '../../types';

// Mock PatternProductGroup to avoid deep rendering tree
vi.mock('../PatternProductGroup', () => ({
  PatternProductGroup: ({
    patternName,
    products,
  }: {
    patternName: string;
    products: ResearchProduct[];
  }) => (
    <div data-testid={`pattern-group-${patternName}`}>
      <span data-testid={`label-${patternName}`}>{patternName}</span>
      <span data-testid={`count-${patternName}`}>{products.length}</span>
    </div>
  ),
}));

const makeProduct = (
  asin: string,
  emotionalPattern?: string,
): ResearchProduct => ({
  asin,
  title: `Product ${asin}`,
  brand: 'TestBrand',
  url: `https://amazon.com/dp/${asin}`,
  rating: 4.5,
  reviews_count: 100,
  thumbnail_url: '',
  brand_blocked: false,
  vision_analysis: null,
  emotional_analysis: emotionalPattern
    ? {
        emotional_pattern: emotionalPattern,
        customer_psychology: {
          buyer_profile: '',
          emotional_need: '',
          internal_monologue: '',
          what_they_cant_say_out_loud: '',
        },
        sentiment_analysis: {
          sentiment: 'Positive',
          primary_emotion: '',
          emotion_target: '',
          confrontation_level: '',
          workplace_culture_required: '',
          humor_style: '',
          humor_function: '',
        },
        vibe: { energy_level: '', attitude: '', core_emotion: '' },
        semantic_structure: {
          structural_template: '',
          wordplay_type: '',
          delivery_style: '',
        },
        key_elements: [],
        tone: '',
        adaptation_formula: '',
        adaptation_examples: [],
        transferability_notes: {
          works_best_in: [],
          avoid_in: [],
          critical_success_factors: [],
        },
      }
    : null,
});

const renderComponent = (products: ResearchProduct[]) =>
  renderWithProviders(
    <GroupedProductAnalysis products={products} nicheId="test-niche" />,
    { reducers: { collectedItems: collectedItemsReducer } },
  );

describe('GroupedProductAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups products by emotional pattern into separate sections', () => {
    const products = [
      makeProduct('A1', '1: IDENTITY DECLARATION'),
      makeProduct('A2', '1: IDENTITY DECLARATION'),
      makeProduct('A3', '12: BOUNDARY/GATEKEEPING'),
    ];

    renderComponent(products);

    const groups = screen.getAllByTestId(/^pattern-group-/);
    expect(groups).toHaveLength(2);

    expect(
      screen.getByTestId('pattern-group-IDENTITY DECLARATION'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('pattern-group-BOUNDARY/GATEKEEPING'),
    ).toBeInTheDocument();
  });

  it('places products without emotional_analysis into Uncategorized', () => {
    const products = [
      makeProduct('A1', '1: IDENTITY DECLARATION'),
      makeProduct('A2'), // no emotional_analysis
    ];

    renderComponent(products);

    expect(screen.getByTestId('pattern-group-Uncategorized')).toBeInTheDocument();
    expect(
      screen.getByTestId('pattern-group-IDENTITY DECLARATION'),
    ).toBeInTheDocument();
  });

  it('shows correct product count per group', () => {
    const products = [
      makeProduct('A1', '1: IDENTITY DECLARATION'),
      makeProduct('A2', '1: IDENTITY DECLARATION'),
      makeProduct('A3', '12: BOUNDARY/GATEKEEPING'),
    ];

    renderComponent(products);

    // IDENTITY DECLARATION group has 2 products
    expect(screen.getByTestId('count-IDENTITY DECLARATION').textContent).toBe('2');

    // BOUNDARY/GATEKEEPING group has 1 product
    expect(screen.getByTestId('count-BOUNDARY/GATEKEEPING').textContent).toBe('1');
  });

  it('renders nothing when products array is empty', () => {
    const { container } = renderComponent([]);
    expect(container.firstChild).toBeNull();
  });

  it('sorts Uncategorized group last', () => {
    const products = [
      makeProduct('A1'), // uncategorized
      makeProduct('A2', '1: IDENTITY DECLARATION'),
    ];

    renderComponent(products);

    const groups = screen.getAllByTestId(/^label-/);
    const labels = groups.map((el) => el.textContent);

    expect(labels[labels.length - 1]).toBe('Uncategorized');
  });
});
