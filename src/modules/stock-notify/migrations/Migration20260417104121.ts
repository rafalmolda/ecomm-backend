import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260417104121 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "stock_notify_subscription" ("id" text not null, "email" text not null, "product_id" text not null, "locale" text not null, "notified_at" timestamptz null, "unsubscribe_token" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "stock_notify_subscription_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_snsub_pending_unique" ON "stock_notify_subscription" ("email", "product_id") WHERE "notified_at" IS NULL AND "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_snsub_product_notified" ON "stock_notify_subscription" ("product_id", "notified_at") WHERE "deleted_at" IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_snsub_unsubscribe_token" ON "stock_notify_subscription" ("unsubscribe_token") WHERE "deleted_at" IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "stock_notify_subscription" cascade;`)
  }
}
