import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260423150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "loyalty_ledger" ("id" text not null, "customer_id" text not null, "delta" integer not null, "reason" text not null, "order_id" text null, "currency" text null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_ledger_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_ledger_customer_id" ON "loyalty_ledger" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_ledger_order_id" ON "loyalty_ledger" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_ledger_created_at" ON "loyalty_ledger" ("created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_ledger_deleted_at" ON "loyalty_ledger" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_ledger" cascade;`);
  }

}
