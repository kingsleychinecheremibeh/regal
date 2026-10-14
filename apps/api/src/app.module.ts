import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { readConfig } from "./config";
import { CONFIG, Database } from "./db/database";
import { WaitlistService } from "./waitlist.service";
import {
  AuthController,
  AuthService,
  SessionGuard,
  UsersController,
} from "./auth";
import { DemoController, DemoService } from "./demo";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [AppController, AuthController, UsersController, DemoController],
  providers: [
    { provide: CONFIG, useFactory: readConfig },
    Database,
    WaitlistService,
    AuthService,
    SessionGuard,
    DemoService,
  ],
})
export class AppModule {}
