import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { AppConfig } from "../config";

export const CONFIG = Symbol("CONFIG");

@Injectable()
export class Database implements OnModuleDestroy {
  readonly db: PgDatabase<PgQueryResultHKT>;
  private readonly close: () => Promise<void>;

  constructor(@Inject(CONFIG) config: AppConfig) {
    // Hosts that block outbound port 5432 (shared cPanel) reach Neon through
    // its WebSocket proxy on 443 instead. Needs Node's global WebSocket (22+).
    if (config.DATABASE_DRIVER === "neon-websocket") {
      const pool = new Pool({ connectionString: config.DATABASE_URL, max: 5 });
      this.db = drizzleNeon({ client: pool });
      this.close = () => pool.end();
    } else {
      const client = postgres(config.DATABASE_URL, { max: 5 });
      this.db = drizzlePostgres(client);
      this.close = () => client.end();
    }
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
