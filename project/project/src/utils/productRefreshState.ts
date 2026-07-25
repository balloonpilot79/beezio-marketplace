export interface ProductRefreshFailureState {
  keepCurrentProduct: boolean;
  errorMessage: string | null;
}

export const resolveProductRefreshFailure = (
  hasRenderedProduct: boolean,
  error: unknown
): ProductRefreshFailureState => {
  if (hasRenderedProduct) {
    return {
      keepCurrentProduct: true,
      errorMessage: null,
    };
  }

  return {
    keepCurrentProduct: false,
    errorMessage: error instanceof Error ? error.message : 'Unable to load product.',
  };
};
