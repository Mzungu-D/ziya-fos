export interface BankProviderDefinition {
  id: string;
  name: string;
  requiresApiKey: boolean;
  requiresApiSecret: boolean;
  requiresClientId: boolean;
  requiresClientSecret: boolean;
  supportsWebhooks: boolean;
}

/**
 * Banks/providers available to the Ziya FOS
 * bank-integration interface.
 *
 * This registry controls what the customer
 * sees in the UI. It does not contain customer
 * credentials.
 */
export const BANK_PROVIDERS: readonly BankProviderDefinition[] =
  [
    {
      id: "kcb",
      name: "KCB Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "equity",
      name: "Equity Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "coop",
      name: "Co-operative Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "ncba",
      name: "NCBA Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "absa",
      name: "Absa Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "stanbic",
      name: "Stanbic Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "im",
      name: "I&M Bank",
      requiresApiKey: true,
      requiresApiSecret: true,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },

    {
      id: "custom",
      name: "Other / Custom Bank",
      requiresApiKey: false,
      requiresApiSecret: false,
      requiresClientId: false,
      requiresClientSecret: false,
      supportsWebhooks: true,
    },
  ] as const;

export function getBankProvider(
  providerId: string,
): BankProviderDefinition | undefined {
  const normalized =
    providerId
      .trim()
      .toLowerCase();

  return BANK_PROVIDERS.find(
    (provider) =>
      provider.id === normalized,
  );
}

export function getBankProviders(): BankProviderDefinition[] {
  return [...BANK_PROVIDERS];
}

export function isSupportedBankProvider(
  providerId: string,
): boolean {
  return Boolean(
    getBankProvider(providerId),
  );
}