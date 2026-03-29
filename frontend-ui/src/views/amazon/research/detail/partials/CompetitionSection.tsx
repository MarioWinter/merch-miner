import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SimilarProduct } from '../../types';
import ProductCarousel from './ProductCarousel';

interface CompetitionSectionProps {
  similarProducts: SimilarProduct[];
  sameBrandProducts: SimilarProduct[];
}

const CompetitionSection = ({
  similarProducts,
  sameBrandProducts,
}: CompetitionSectionProps) => {
  const { t } = useTranslation();

  return (
    <Stack spacing={3}>
      <ProductCarousel
        title={t('amazonResearch.detail.similarDesigns')}
        products={similarProducts}
        emptyMessage={t('amazonResearch.detail.noSimilar')}
      />
      <ProductCarousel
        title={t('amazonResearch.detail.sameBrand')}
        products={sameBrandProducts}
        emptyMessage={t('amazonResearch.detail.noSameBrand')}
      />
    </Stack>
  );
};

export default CompetitionSection;
