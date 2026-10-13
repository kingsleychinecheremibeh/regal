import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { AppConfig } from "../config";

export const CONFIG = Symbol("CONFIG");

@Injectable()
export class Database implements OnModuleDestroy {
  private readonly client: ReturnType<typeof postgres>;
  readonly db: ReturnType<typeof drizzle>;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.client = postgres(config.DATABASE_URL, { max: 5 });
    this.db = drizzle(this.client);
  }

  async ping(): Promise<void> {
    await this.client`select 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end();
  }
}
