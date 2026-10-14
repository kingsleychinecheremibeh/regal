import "dotenv/config";
import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { readConfig } from "./config";
import { ApiErrorFilter } from "./error.filter";

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  app.set("trust proxy", config.TRUST_PROXY_HOPS);
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({
    origin: config.CORS_ORIGINS,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Idempotency-Key"],
    credentials: true,
  });
  app.useGlobalFilters(new ApiErrorFilter());

  const openApiConfig = new DocumentBuilder()
    .setTitle("Regalvest 2.0 Investor Demo API")
    .setDescription(
      "Real account identity and isolated financial simulations. No real money movement or investment service.",
    )
    .setVersion("1.0")
    .addCookieAuth("regalvest_session", {
      type: "apiKey",
      in: "cookie",
      name: "regalvest_session",
    })
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, openApiConfig),
  );

  await app.listen(config.PORT, "0.0.0.0");
}

void bootstrap();
