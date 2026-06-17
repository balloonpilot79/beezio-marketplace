/**
/**
 * Deprecated frontend-only test harness.
 *
 * The original end-to-end marketplace transaction test code does not belong in
 * the browser bundle. It also referenced server-only APIs.
 *
 * This stub keeps any imports compiling while preventing accidental execution.
 */

export class MarketplaceTransactionTester {
  async runCompleteTransactionTest(): Promise<void> {
    throw new Error(
      'Complete transaction test is disabled in the frontend bundle. Use server-side scripts for end-to-end transaction testing.'
    );
  }
}

export const marketplaceTransactionTester = new MarketplaceTransactionTester();
// Export for use in test files
export const marketplaceTransactionTester = new MarketplaceTransactionTester()

// Run test if this file is executed directly
if (import.meta.main) {
  marketplaceTransactionTester.runCompleteTransactionTest()
}