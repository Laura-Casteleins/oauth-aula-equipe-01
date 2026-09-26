export const providers = {
  google: {
    authUrl:
      "https://accounts.google.com/o/oauth2/v2/auth",

    tokenUrl:
      "https://oauth2.googleapis.com/token",

    discoveryUrl:
      "https://accounts.google.com/.well-known/openid-configuration"
  },

  github: {
    authUrl:
      "https://github.com/login/oauth/authorize",

    tokenUrl:
      "https://github.com/login/oauth/access_token",

    userUrl:
      "https://api.github.com/user"
  }
};
