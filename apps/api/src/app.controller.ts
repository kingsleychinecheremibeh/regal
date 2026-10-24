import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { z } from "zod";
import {
  ErrorDto,
  HealthDto,
  ProductDto,
  WaitlistInputDto,
  WaitlistResultDto,
} from "./api.dto";
import { Database } from "./db/database";
import { contactMessages } from "./db/schema";
import { products } from "./products";
import { WaitlistService } from "./waitlist.service";

const contactInput = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  message: z.string().trim().min(5).max(2000),
  topic: z
    .string()
    .trim()
    .regex(/^[a-z-]{2,40}$/)
    .default("contact"),
});

const waitlistInput = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true),
});

@ApiTags("TurboXGlobal public")
@ApiExtraModels(ProductDto)
@Controller("api/v1")
export class AppController {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Check API and database readiness" })
  @ApiOkResponse({
    type: HealthDto,
    example: {
      status: "ok",
      service: "turboxglobal-api",
      timestamp: "2026-10-13T12:00:00.000Z",
    },
  })
  @ApiServiceUnavailableResponse({
    type: ErrorDto,
    description: "Database is unavailable.",
  })
  async health(): Promise<HealthDto> {
    try {
      await this.database.ping();
    } catch {
      throw new HttpException("Service unavailable", 503);
    }
    return {
      status: "ok",
      service: "turboxglobal-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health/ready")
  @ApiOperation({ summary: "Check API and PostgreSQL readiness" })
  @ApiOkResponse({ type: HealthDto })
  ready(): Promise<HealthDto> {
    return this.health();
  }

  @Get("products")
  @ApiOperation({
    summary:
      "List five planned product categories; none are live financial services",
  })
  @ApiOkResponse({
    schema: { type: "array", items: { $ref: getSchemaPath(ProductDto) } },
  })
  getProducts(): ProductDto[] {
    return products.map((product) => ({
      ...product,
      capabilities: [...product.capabilities],
    }));
  }

  @Post("waitlist")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Join the pre-launch waitlist; repeat submissions receive the same response",
  })
  @ApiBody({ type: WaitlistInputDto })
  @ApiOkResponse({
    type: WaitlistResultDto,
    example: { message: "Thanks for your interest. You are on the waitlist." },
  })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: "Invalid email or consent was not granted.",
  })
  @ApiTooManyRequestsResponse({
    type: ErrorDto,
    description: "Too many submissions from this IP.",
  })
  async joinWaitlist(@Body() body: unknown): Promise<WaitlistResultDto> {
    const result = waitlistInput.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        "Enter a valid email and agree to the privacy notice.",
      );
    }
    await this.waitlist.join(result.data.email);
    return { message: "Thanks for your interest. You are on the waitlist." };
  }

  @Post("contact")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Send a message from a public contact form" })
  @ApiBody({
    schema: {
      type: "object",
      example: {
        name: "Ada Investor",
        email: "ada@example.com",
        message: "I would like a walkthrough.",
        topic: "business",
      },
    },
  })
  @ApiOkResponse({ type: WaitlistResultDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiTooManyRequestsResponse({ type: ErrorDto })
  async contact(@Body() body: unknown): Promise<WaitlistResultDto> {
    const result = contactInput.safeParse(body);
    if (!result.success)
      throw new BadRequestException(
        "Enter your name, a valid email and a message.",
      );
    await this.database.db.insert(contactMessages).values(result.data);
    return { message: "Thank you. We will reply by email." };
  }
}
