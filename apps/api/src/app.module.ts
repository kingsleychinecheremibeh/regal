import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminController, AdminGuard } from "./admin";
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
import { DemoController } from "./demo/controller";
import { DemoCore } from "./demo/core";
import { MoneyService } from "./demo/money";
import { RecordsService } from "./demo/records";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    DemoController,
    AdminController,
  ],
  providers: [
    { provide: CONFIG, useFactory: readConfig },
    Database,
    WaitlistService,
    AuthService,
    SessionGuard,
    AdminGuard,
    DemoCore,
    MoneyService,
    RecordsService,
  ],
})
export class AppModule {}
