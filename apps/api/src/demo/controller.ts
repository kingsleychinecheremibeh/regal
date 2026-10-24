import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { SessionGuard } from "../auth";
import { MoneyService } from "./money";
import { RecordsService } from "./records";

type UserRequest = { userId: string };

function SimulatedAction(summary: string, example: Record<string, unknown>) {
  return applyDecorators(
    HttpCode(200),
    ApiOperation({ summary: `${summary} (simulated funds only)` }),
    ApiHeader({
      name: "Idempotency-Key",
      required: true,
      description:
        "Unique key per intended action (8–100 characters). Repeats return the original result.",
    }),
    ApiBody({ schema: { type: "object", example } }),
    ApiBadRequestResponse({
      description: "Invalid input, insufficient demo balance or a limit",
    }),
    ApiForbiddenResponse({ description: "Verification required" }),
  );
}

@ApiTags("Simulated financial demo")
@ApiCookieAuth("regalvest_session")
@ApiUnauthorizedResponse({ description: "Valid session required" })
@Controller("api/v1/demo")
@UseGuards(SessionGuard)
export class DemoController {
  constructor(
    @Inject(MoneyService) private readonly money: MoneyService,
    @Inject(RecordsService) private readonly records: RecordsService,
  ) {}

  @Get("state")
  @ApiOperation({ summary: "Profile, verification status and unread count" })
  state(@Req() req: UserRequest) {
    return this.records.state(req.userId);
  }

  @Get("overview")
  @ApiOperation({ summary: "Balances, limits, recent activity and accounts" })
  overview(@Req() req: UserRequest) {
    return this.records.overview(req.userId);
  }

  /* ---------- trading ---------- */

  @Get("markets")
  @ApiOperation({ summary: "Fixed illustrative prices, chart and order book" })
  markets(
    @Req() req: UserRequest,
    @Query("symbol") symbol?: string,
    @Query("points") points?: string,
  ) {
    return this.records.markets(req.userId, symbol, Number(points) || 60);
  }

  @Post("watchlist/:symbol") @HttpCode(200) watch(
    @Req() req: UserRequest,
    @Param("symbol") symbol: string,
  ) {
    return this.money.toggleWatch(req.userId, symbol);
  }

  @Post("trades/quote") @HttpCode(200) quoteTrade(@Body() body: unknown) {
    return this.money.quoteTrade(body);
  }

  @Post("trades")
  @SimulatedAction("Buy, sell or swap a digital asset", {
    side: "buy",
    symbol: "BTC",
    quantity: "0.01",
  })
  trade(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.trade(req.userId, body, key);
  }

  @Post("orders/limit")
  @SimulatedAction("Place a limit order", {
    side: "buy",
    symbol: "ETH",
    quantity: "0.5",
    limitPrice: 2900,
  })
  limit(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.limitOrder(req.userId, body, key);
  }

  @Post("orders/:id/cancel") @HttpCode(200) cancelOrder(
    @Req() req: UserRequest,
    @Param("id") id: string,
  ) {
    return this.money.cancelOrder(req.userId, id);
  }

  /* ---------- payments ---------- */

  @Get("beneficiaries") beneficiaries(@Req() req: UserRequest) {
    return this.money.beneficiaries(req.userId);
  }

  @Post("beneficiaries") addBeneficiary(
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.money.addBeneficiary(req.userId, body);
  }

  @Delete("beneficiaries/:id") removeBeneficiary(
    @Req() req: UserRequest,
    @Param("id") id: string,
  ) {
    return this.money.removeBeneficiary(req.userId, id);
  }

  @Post("payments/quote") @HttpCode(200) quotePayment(
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.money.quotePayment(req.userId, body);
  }

  @Post("payments")
  @SimulatedAction("Send a transfer or pay a bill", {
    kind: "transfer",
    beneficiaryId: "00000000-0000-0000-0000-000000000000",
    currency: "USD",
    amount: "120.00",
  })
  pay(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.pay(req.userId, body, key);
  }

  /* ---------- accounts ---------- */

  @Get("accounts") accounts(@Req() req: UserRequest) {
    return this.money.accounts(req.userId);
  }

  @Post("accounts/:currency/request") @HttpCode(200) requestAccount(
    @Req() req: UserRequest,
    @Param("currency") currency: string,
  ) {
    return this.money.requestAccount(req.userId, currency);
  }

  @Post("convert/quote") @HttpCode(200) quoteConvert(@Body() body: unknown) {
    return this.money.quoteConvert(body);
  }

  @Post("convert")
  @SimulatedAction("Convert between USD, EUR and GBP", {
    from: "USD",
    to: "EUR",
    amount: "100",
  })
  convert(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.convert(req.userId, body, key);
  }

  @Post("deposits")
  @SimulatedAction("Start a deposit", {
    currency: "USD",
    amount: "500",
    method: "bank",
  })
  deposit(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.deposit(req.userId, body, key);
  }

  @Post("withdrawals")
  @SimulatedAction("Withdraw to a bank", { currency: "USD", amount: "200" })
  withdraw(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.withdraw(req.userId, body, key);
  }

  /* ---------- cards ---------- */

  @Get("cards") cards(@Req() req: UserRequest) {
    return this.money.cards(req.userId);
  }

  @Post("cards") createCard(@Req() req: UserRequest, @Body() body: unknown) {
    return this.money.createCard(req.userId, body);
  }

  @Patch("cards/:id") updateCard(
    @Req() req: UserRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.money.updateCard(req.userId, id, body);
  }

  @Post("cards/:id/cancel") @HttpCode(200) cancelCard(
    @Req() req: UserRequest,
    @Param("id") id: string,
  ) {
    return this.money.cancelCard(req.userId, id);
  }

  @Post("cards/:id/reveal")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Reveal fictitious card details after a simulated MFA code (any 6 digits)",
  })
  reveal(
    @Req() req: UserRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.money.revealCard(req.userId, id, body);
  }

  @Post("cards/:id/purchase")
  @SimulatedAction("Simulate a merchant purchase on a card", {})
  purchase(
    @Req() req: UserRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.purchase(req.userId, id, key);
  }

  /* ---------- wealth ---------- */

  @Post("investments")
  @SimulatedAction("Invest in a wealth product", {
    productId: "GEQ",
    amount: "250",
    acknowledgedRisk: true,
  })
  invest(
    @Req() req: UserRequest,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.money.invest(req.userId, body, key);
  }

  /* ---------- records ---------- */

  @Get("transactions") transactions(
    @Req() req: UserRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.records.transactions(req.userId, query);
  }

  @Get("transactions/export.csv")
  @ApiOperation({ summary: "Download the filtered demo ledger as CSV" })
  async csv(
    @Req() req: UserRequest,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const body = await this.records.csv(req.userId, query);
    res
      .type("text/csv; charset=utf-8")
      .attachment("turboxglobal-transactions.csv")
      .send(body);
  }

  @Get("transactions/:id") transaction(
    @Req() req: UserRequest,
    @Param("id") id: string,
  ) {
    return this.records.transaction(req.userId, id);
  }

  @Get("statements") statements(@Req() req: UserRequest) {
    return this.records.statementPeriods(req.userId);
  }

  @Get("statements/:period")
  @ApiOperation({
    summary: "Generate a statement (HTML or CSV) from the demo ledger",
  })
  async statement(
    @Req() req: UserRequest,
    @Param("period") period: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const file = await this.records.statement(req.userId, period, query);
    res.type(file.type);
    if (file.type.startsWith("text/csv")) res.attachment(file.name);
    else
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      );
    res.send(file.body);
  }

  @Get("notifications") notifications(@Req() req: UserRequest) {
    return this.records.notifications(req.userId);
  }

  @Post("notifications/read") @HttpCode(200) readAll(@Req() req: UserRequest) {
    return this.records.readNotification(req.userId);
  }

  @Post("notifications/:id/read") @HttpCode(200) read(
    @Req() req: UserRequest,
    @Param("id") id: string,
  ) {
    return this.records.readNotification(req.userId, id);
  }

  @Get("referrals") referrals(@Req() req: UserRequest) {
    return this.records.referrals(req.userId);
  }

  @Get("tickets") tickets(@Req() req: UserRequest) {
    return this.records.tickets(req.userId);
  }

  @Post("tickets") createTicket(
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.records.createTicket(req.userId, body);
  }

  /* ---------- verification and profile ---------- */

  @Get("verification") verification(@Req() req: UserRequest) {
    return this.records.verification(req.userId);
  }

  @Put("verification/:kind/:step")
  @ApiOperation({
    summary:
      "Save one KYC or KYB step. Files are described by name, type and size only.",
  })
  saveStep(
    @Req() req: UserRequest,
    @Param("kind") kind: string,
    @Param("step") step: string,
    @Body() body: unknown,
  ) {
    return this.records.saveStep(req.userId, kind, step, body);
  }

  @Post("verification/:kind/submit") @HttpCode(200) submit(
    @Req() req: UserRequest,
    @Param("kind") kind: string,
  ) {
    return this.records.submit(req.userId, kind);
  }

  @Post("verification/:kind/review")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Investor demo control: approve, request information or reject your own case",
  })
  review(
    @Req() req: UserRequest,
    @Param("kind") kind: string,
    @Body() body: unknown,
  ) {
    return this.records.review(req.userId, kind, body);
  }

  @Patch("profile") profile(@Req() req: UserRequest, @Body() body: unknown) {
    return this.records.updateProfile(req.userId, body);
  }

  /* ---------- acquiring ---------- */

  @Get("acquiring") acquiring(@Req() req: UserRequest) {
    return this.records.acquiring(req.userId);
  }

  @Post("acquiring/links") createLink(
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.records.createLink(req.userId, body);
  }

  @Post("acquiring/keys") createKey(
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.records.createKey(req.userId, body);
  }

  @Delete("acquiring/keys/:id") revokeKey(
    @Req() req: UserRequest,
    @Param("id") id: string,
  ) {
    return this.records.revokeKey(req.userId, id);
  }

  @Post("reset") @HttpCode(200) reset(
    @Req() req: UserRequest,
    @Body() body: unknown,
  ) {
    return this.records.reset(req.userId, body);
  }
}
