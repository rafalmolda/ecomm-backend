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
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },
    {
      key: Modules.FILE,
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            // The default file-local provider stores files in
            // .medusa/server/static/ and serves them via Medusa's
            // /static/<filename> endpoint. Without an explicit
            // backend_url, the file-local module hardcodes
            // http://localhost:9000/static in the URL it returns
            // from uploads — which means uploaded file URLs don't
            // work in the browser. Pin backend_url to the public
            // api host so upload responses return correct URLs.
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
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
