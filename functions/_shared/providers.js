export const PROVIDERS = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid profile email",
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
  },
};

export function getProviderConfig(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Provedor não suportado: ${providerName}`);
  }
  return provider;
}
