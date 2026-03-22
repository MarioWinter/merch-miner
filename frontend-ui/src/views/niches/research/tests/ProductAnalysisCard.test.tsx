import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { ProductAnalysisCard } from '../partials/ProductAnalysisCard';
import collectedItemsReducer from '@/store/collectedItemsSlice';
import type { ResearchProduct } from '../types';

const product: ResearchProduct = {
  asin: 'B09TEST123',
  title: 'Funny Hiking T-Shirt for Men',
  brand: 'TrailWear',
  url: 'https://amazon.com/dp/B09TEST123',
  rating: 4.5,
  reviews_count: 142,
  thumbnail_url: 'https://images.amazon.com/test.jpg',
  brand_blocked: false,
  vision_analysis: {
    slogan_text: 'I Hike Because Murder Is Wrong',
    meaning_context: 'Dark humor about stress relief via hiking',
    visual_style: 'Bold white text on dark background',
    graphic_elements: 'Mountain silhouette',
    layout_composition: 'Centered text with graphic below',
  },
  emotional_analysis: {
    customer_psychology: {
      buyer_profile: 'Active outdoor enthusiast, 30-50',
      emotional_need: 'Identity validation through humor',
      internal_monologue: 'This shirt IS me',
      what_they_cant_say_out_loud: 'I need people to know hiking defines me',
    },
    sentiment_analysis: {
      sentiment: 'Positive',
      primary_emotion: 'Pride',
      emotion_target: 'Self',
      confrontation_level: 'Moderate',
      workplace_culture_required: 'Casual',
      humor_style: 'Dark humor',
      humor_function: 'Social bonding',
    },
    emotional_pattern: '1: IDENTITY_DECLARATION',
    vibe: {
      energy_level: 'High',
      attitude: 'Playful',
      core_emotion: 'Pride',
    },
    semantic_structure: {
      structural_template: '[Activity] because [Dark Alternative]',
      wordplay_type: 'Contrast humor',
      delivery_style: 'Direct statement',
    },
    key_elements: ['hiking', 'murder', 'humor'],
    tone: 'Darkly humorous',
    adaptation_formula: 'I [ACTIVITY] Because [DARK_ALTERNATIVE] Is Wrong',
    adaptation_examples: ['I Fish Because Arson Is Wrong', 'I Cook Because Chaos Is Wrong'],
    transferability_notes: {
      works_best_in: ['Outdoor niches', 'Hobby niches'],
      avoid_in: ['Professional niches', 'Kids niches'],
      critical_success_factors: ['Target audience comfort with dark humor'],
    },
  },
};

const productNoAnalysis: ResearchProduct = {
  asin: 'B09BARE456',
  title: 'Plain Hiking Tee',
  brand: 'BasicWear',
  url: 'https://amazon.com/dp/B09BARE456',
  rating: 3.2,
  reviews_count: 12,
  thumbnail_url: '',
  brand_blocked: false,
  vision_analysis: null,
  emotional_analysis: null,
};

const opts = { reducers: { collectedItems: collectedItemsReducer } };

describe('ProductAnalysisCard', () => {
  it('renders product title and ASIN', () => {
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    expect(screen.getByText(product.title)).toBeInTheDocument();
    expect(screen.getByText(product.asin)).toBeInTheDocument();
  });

  it('renders brand name', () => {
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    expect(screen.getByText('TrailWear')).toBeInTheDocument();
  });

  it('renders review count', () => {
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    expect(screen.getByText('142 reviews')).toBeInTheDocument();
  });

  it('renders slogan chip when vision analysis exists', () => {
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    const matches = screen.getAllByText('I Hike Because Murder Is Wrong');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders emotional pattern chip when emotional analysis exists', () => {
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    const matches = screen.getAllByText('1: IDENTITY_DECLARATION');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render chips when no analysis', () => {
    renderWithProviders(<ProductAnalysisCard product={productNoAnalysis} nicheId="n-1" />, opts);

    expect(screen.getByText('Plain Hiking Tee')).toBeInTheDocument();
    expect(screen.queryByText('IDENTITY_DECLARATION')).not.toBeInTheDocument();
  });

  it('expands to show detailed analysis on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    // Details collapsed by default (MUI Collapse renders children in DOM with height: 0px)
    const collapseRegion = screen.getByText('Dark humor about stress relief via hiking').closest('.MuiCollapse-root') as HTMLElement;
    expect(collapseRegion).toHaveStyle({ height: '0px' });

    // Click expand
    const expandBtn = screen.getByRole('button', { name: /expand/i });
    await user.click(expandBtn);

    // Vision details in DOM
    expect(screen.getByText('Dark humor about stress relief via hiking')).toBeInTheDocument();
    expect(screen.getByText('Bold white text on dark background')).toBeInTheDocument();
    expect(screen.getByText('Mountain silhouette')).toBeInTheDocument();

    // Emotional details in DOM
    expect(screen.getByText('Darkly humorous')).toBeInTheDocument();
    expect(screen.getByText('High / Playful / Pride')).toBeInTheDocument();

    // Psychology details in DOM
    expect(screen.getByText('Active outdoor enthusiast, 30-50')).toBeInTheDocument();
    expect(screen.getByText('Identity validation through humor')).toBeInTheDocument();

    // Adaptation
    expect(screen.getByText('I [ACTIVITY] Because [DARK_ALTERNATIVE] Is Wrong')).toBeInTheDocument();
    expect(screen.getByText('I Fish Because Arson Is Wrong')).toBeInTheDocument();
  });

  it('renders thumbnail image when URL provided', () => {
    renderWithProviders(<ProductAnalysisCard product={product} nicheId="n-1" />, opts);

    const img = screen.getByRole('img', { name: product.title });
    expect(img).toHaveAttribute('src', product.thumbnail_url);
  });

  it('does not render thumbnail when URL is empty', () => {
    renderWithProviders(<ProductAnalysisCard product={productNoAnalysis} nicheId="n-1" />, opts);

    expect(screen.queryByRole('img', { name: productNoAnalysis.title })).not.toBeInTheDocument();
  });
});
