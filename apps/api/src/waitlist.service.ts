import { Inject, Injectable } from "@nestjs/common";
import { Database } from "./db/database";
import { waitlist } from "./db/schema";

@Injectable()
export class WaitlistService {
  constructor(@Inject(Database) private readonly database: Database) {}

  async join(email: string): Promise<void> {
    await this.database.db
      .insert(waitlist)
      .values({ email, consentAt: new Date() })
      .onConflictDoNothing({ target: waitlist.email });
  }
}
