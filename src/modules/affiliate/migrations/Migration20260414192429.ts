import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260414192429 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "affiliate_partner" drop constraint if exists "affiliate_partner_promotion_code_unique";`);
    this.addSql(`create table if not exists "affiliate_partner" ("id" text not null, "name" text not null, "email" text not null, "promotion_code" text not null, "commission_pct" integer not null, "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "affiliate_partner_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_affiliate_partner_promotion_code_unique" ON "affiliate_partner" ("promotion_code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_affiliate_partner_deleted_at" ON "affiliate_partner" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "affiliate_partner" cascade;`);
  }

}
