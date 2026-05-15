import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: process.env.DATABASE_URL?.includes('supabase')
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : {},
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    {
      resolve: "./src/modules/affiliate",
    },
    {
      resolve: "./src/modules/stock-notify",
    },
    {
      resolve: "./src/modules/loyalty",
    },
    {
      key: Modules.CACHE,
      resolve: "@medusajs/cache-redis",
      options: { redisUrl: process.env.REDIS_URL },
    },
    {
      key: Modules.EVENT_BUS,
      resolve: "@medusajs/event-bus-redis",
      options: { redisUrl: process.env.REDIS_URL },
    },
    {
      key: Modules.WORKFLOW_ENGINE,
      resolve: "@medusajs/workflow-engine-redis",
      // Note: the module prints a deprecation warning asking to use `redisUrl`,
      // but passing `redisUrl` directly crashes on startup because the loader
      // still destructures `{ url }` from a nested `redis` object. The nested
      // form is what actually works as of @medusajs/workflow-engine-redis@2.13.6.
      // Upstream bug. Revisit when the package is patched.
      options: {
        redis: { url: process.env.REDIS_URL },
      },
    },
    {
      key: Modules.LOCKING,
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "redis",
            options: { redisUrl: process.env.REDIS_URL },
          },
        ],
      },
    },
    {
      // No `providers:` block — Medusa auto-registers the built-in system
      // provider as `pp_system_default`, which is what we use. All real
      // PayPal Orders v2 + capture work happens in the storefront's
      // /api/paypal/* routes (server-side only, secret never on client),
      // then /store/carts/:id/complete authorizes this no-op session and
      // creates the order. PayPal is the source of truth for payment
      // status; Medusa records the order with provider id `pp_system_default`.
      // Banned from Stripe 2026-05-15 → @medusajs/medusa/payment-stripe
      // provider removed.
      resolve: "@medusajs/medusa/payment",
    },
    {
      key: Modules.FILE,
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            // upload_dir is set to an absolute path OUTSIDE .medusa/server/
            // because `npx medusa build` wipes the entire .medusa/server/
            // directory — if files live there, every deploy loses all
            // previously-uploaded product images. The absolute path persists
            // across builds. backend_url is pinned so upload responses return
            // correct public URLs (default hardcodes localhost:9000).
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "/opt/apps/lifespansupply/backend/uploads",
              backend_url: (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000") + "/static",
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "@medusajs/auth-google",
            id: "google",
            options: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              callbackUrl: process.env.GOOGLE_CALLBACK_URL || "https://api.lifespansupply.com/auth/customer/google/callback",
            },
          },
        ],
      },
    },
  ],
})
