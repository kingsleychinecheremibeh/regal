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
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  });
  app.useGlobalFilters(new ApiErrorFilter());

  const openApiConfig = new DocumentBuilder()
    .setTitle("Regalvest 2.0 Investor MVP API")
    .setDescription(
      "Pre-launch proof of concept. Products are planned; the waitlist is functional.",
    )
    .setVersion("1.0")
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, openApiConfig),
  );

  await app.listen(config.PORT, "0.0.0.0");
}

void bootstrap();
