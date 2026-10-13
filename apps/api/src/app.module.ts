import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { readConfig } from "./config";
import { CONFIG, Database } from "./db/database";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [AppController],
  providers: [
    { provide: CONFIG, useFactory: readConfig },
    Database,
    WaitlistService,
  ],
})
export class AppModule {}
