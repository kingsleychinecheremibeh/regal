CREATE TABLE "account_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_type" varchar(12) DEFAULT 'personal' NOT NULL,
	"business_name" varchar(120),
	"referral_code" varchar(20) NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"notify" jsonb DEFAULT '{"email":true,"push":true,"sms":false,"marketing":false}'::jsonb NOT NULL,
	"funded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"topic" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"last4" varchar(4) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_beneficiaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(8) DEFAULT 'person' NOT NULL,
	"name" varchar(120) NOT NULL,
	"country" varchar(60) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"account_last4" varchar(4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_global_accounts" (
	"user_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(12) NOT NULL,
	"account_number" varchar(34) NOT NULL,
	"routing" varchar(20) NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_global_accounts_user_id_currency_pk" PRIMARY KEY("user_id","currency")
);
--> statement-breakpoint
CREATE TABLE "demo_holdings" (
	"user_id" uuid NOT NULL,
	"asset" varchar(8) NOT NULL,
	"units" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "demo_holdings_user_id_asset_pk" PRIMARY KEY("user_id","asset")
);
--> statement-breakpoint
CREATE TABLE "demo_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"debit_asset" varchar(8),
	"debit_units" bigint,
	"credit_asset" varchar(8),
	"credit_units" bigint,
	"fee_asset" varchar(8),
	"fee_units" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) NOT NULL,
	"usd_cents" bigint NOT NULL,
	"card_id" uuid,
	"meta" jsonb,
	"description" varchar(160) NOT NULL,
	"reference" varchar(20) NOT NULL,
	"provider_ref" varchar(24) NOT NULL,
	"status" varchar(12) NOT NULL,
	"reason" varchar(200),
	"settle_at" timestamp with time zone,
	"idempotency_key" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_limit_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" varchar(8) NOT NULL,
	"side" varchar(4) NOT NULL,
	"units" bigint NOT NULL,
	"limit_price" double precision NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_watchlist" (
	"user_id" uuid NOT NULL,
	"symbol" varchar(8) NOT NULL,
	CONSTRAINT "demo_watchlist_user_id_symbol_pk" PRIMARY KEY("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"subject" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(3) NOT NULL,
	"status" varchar(20) DEFAULT 'not_started' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" varchar(300),
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demo_cards" ADD COLUMN "last4" varchar(4);--> statement-breakpoint
ALTER TABLE "demo_cards" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demo_notifications" ADD COLUMN "category" varchar(20) DEFAULT 'Account' NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_notifications" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_profiles" ADD CONSTRAINT "account_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_api_keys" ADD CONSTRAINT "demo_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_beneficiaries" ADD CONSTRAINT "demo_beneficiaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_global_accounts" ADD CONSTRAINT "demo_global_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_holdings" ADD CONSTRAINT "demo_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_ledger" ADD CONSTRAINT "demo_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_limit_orders" ADD CONSTRAINT "demo_limit_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_payment_links" ADD CONSTRAINT "demo_payment_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_watchlist" ADD CONSTRAINT "demo_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "demo_ledger_idempotency_unique" ON "demo_ledger" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "demo_ledger_user_created" ON "demo_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_user_kind" ON "verification_cases" USING btree ("user_id","kind");