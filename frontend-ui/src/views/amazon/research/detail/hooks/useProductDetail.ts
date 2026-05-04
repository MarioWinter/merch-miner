import {
  useGetProductDetailQuery,
  useGetBSRHistoryFullQuery,
  useGetSimilarProductsQuery,
  useGetSameBrandProductsQuery,
  useGetPriceHistoryQuery,
} from '../../../../../store/researchSlice';

const useProductDetail = (asin: string) => {
  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useGetProductDetailQuery(asin, { skip: !asin });

  const marketplace = product?.marketplace ?? 'amazon_com';

  const {
    data: bsrHistory,
    isLoading: bsrLoading,
  } = useGetBSRHistoryFullQuery(
    { asin, marketplace },
    { skip: !asin || !product },
  );

  const {
    data: similarProducts,
    isLoading: similarLoading,
  } = useGetSimilarProductsQuery(asin, { skip: !asin || !product });

  const {
    data: sameBrandProducts,
    isLoading: sameBrandLoading,
  } = useGetSameBrandProductsQuery(asin, { skip: !asin || !product });

  const {
    data: priceHistory,
    isLoading: priceLoading,
  } = useGetPriceHistoryQuery(
    { asin, marketplace },
    { skip: !asin || !product },
  );

  const isLoading = productLoading;
  const isSecondaryLoading = bsrLoading || similarLoading || sameBrandLoading || priceLoading;
  const is404 = !productLoading && !!productError &&
    typeof productError === 'object' && 'status' in productError &&
    (productError as { status: number }).status === 404;

  return {
    product,
    bsrHistory,
    similarProducts: similarProducts ?? [],
    sameBrandProducts: sameBrandProducts ?? [],
    priceHistory: priceHistory ?? [],
    isLoading,
    isSecondaryLoading,
    is404,
    productError,
  };
};

export default useProductDetail;
