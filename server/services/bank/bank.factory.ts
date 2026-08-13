import {
  BankAdapter,
  BankAdapterConfig,
} from "./bank.adapter";

import {
  GenericBankAdapter,
} from "./providers/generic.adapter";

import {
  getBankProvider,
} from "./bank.providers";

export function createBankAdapter(
  config: BankAdapterConfig,
): BankAdapter {
  const providerId =
    config.provider
      .trim()
      .toLowerCase();

  if (!providerId) {
    throw new Error(
      "Bank integration provider is required.",
    );
  }

  const provider =
    getBankProvider(
      providerId,
    );

  /*
   * Unknown providers are allowed only
   * through the explicit custom provider.
   */
  if (!provider) {
    throw new Error(
      `Unsupported bank integration provider: ${config.provider}`,
    );
  }

  /*
   * The generic adapter is intentionally used
   * until an official provider API adapter has
   * been implemented and verified.
   *
   * This prevents Ziya FOS from pretending that
   * an unsupported bank API is compatible.
   */
  return new GenericBankAdapter({
    ...config,
    provider: provider.id,
  });
}