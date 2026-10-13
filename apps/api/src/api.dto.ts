import { ApiProperty } from "@nestjs/swagger";

export class HealthDto {
  @ApiProperty({ type: String, example: "ok" }) status!: "ok";
  @ApiProperty({ type: String, example: "regalvest-api" }) service!: string;
  @ApiProperty({ type: String, example: "2026-10-13T12:00:00.000Z" })
  timestamp!: string;
}

export class ProductDto {
  @ApiProperty({ type: String, example: "borderless-banking" }) id!: string;
  @ApiProperty({ type: String, example: "Borderless Banking" }) name!: string;
  @ApiProperty({ type: String, example: "planned", enum: ["planned"] })
  status!: "planned";
  @ApiProperty({
    type: String,
    example: "A future home for global money movement.",
  })
  description!: string;
  @ApiProperty({
    type: [String],
    example: ["Multi-currency accounts", "International transfers"],
  })
  capabilities!: string[];
}

export class WaitlistInputDto {
  @ApiProperty({
    type: String,
    example: "investor@example.com",
    format: "email",
  })
  email!: string;
  @ApiProperty({
    type: Boolean,
    example: true,
    description:
      "Explicit consent to receive pre-launch email updates; must be true.",
  })
  consent!: boolean;
}

export class WaitlistResultDto {
  @ApiProperty({
    type: String,
    example: "Thanks for your interest. You are on the waitlist.",
  })
  message!: string;
}

export class ErrorDto {
  @ApiProperty({ type: Number, example: 400 }) statusCode!: number;
  @ApiProperty({ type: String, example: "Invalid request" }) message!: string;
  @ApiProperty({ type: String, example: "Bad Request" }) error!: string;
  @ApiProperty({ type: String, example: "2026-10-13T12:00:00.000Z" })
  timestamp!: string;
  @ApiProperty({ type: String, example: "/api/v1/waitlist" }) path!: string;
}
