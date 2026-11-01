/**
 * NestJS injection tokens for the daemon. Kept in their own module to avoid
 * circular imports between `app.module.ts` and the services/controllers that
 * consume these tokens.
 */
export const PROVIDER_REGISTRY = "PROVIDER_REGISTRY";
