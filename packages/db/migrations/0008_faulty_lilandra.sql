CREATE TYPE "public"."billing_frequency" AS ENUM('monthly', 'quarterly', 'annual', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('maintenance', 'lease', 'license', 'support', 'other');--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"comment" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_assets" (
	"contract_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "contract_assets_contract_id_asset_id_pk" PRIMARY KEY("contract_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"supplier_id" uuid,
	"name" text NOT NULL,
	"contract_type" "contract_type" DEFAULT 'other' NOT NULL,
	"billing_frequency" "billing_frequency" DEFAULT 'annual' NOT NULL,
	"cost_cents" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"renewal_notice_days" integer,
	"comment" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_assets" ADD CONSTRAINT "contract_assets_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_assets" ADD CONSTRAINT "contract_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itil_costs" ADD CONSTRAINT "itil_costs_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE no action ON UPDATE no action;