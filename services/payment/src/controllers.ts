import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppError, type AuthUser, CurrentUser, ENV, Public, uuidv7, ZodPipe } from '@feedants/server-kit';
import {
  type CreateOrderInput,
  createOrderSchema,
  INTERNAL_TOKEN_HEADER,
  type SimulatePaymentInput,
  simulatePaymentSchema,
  type WalletHistoryQuery,
  walletHistoryQuerySchema,
} from '@feedants/shared';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { PaymentEnv } from './config';
import { OrdersService } from './orders/orders.service';
import { PrismaService } from './prisma.service';
import { FakeProvider, PaymentProvider, type ProviderEvent } from './provider/payment-provider';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { WalletService } from './wallet/wallet.service';

/** Service-to-service routes: blocked at the gateway, and authenticated by a shared token. */
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: PaymentEnv) {}

  canActivate(ctx: ExecutionContext): boolean {
    const given = Buffer.from(ctx.switchToHttp().getRequest<Request>().header(INTERNAL_TOKEN_HEADER) ?? '');
    const expected = Buffer.from(this.env.INTERNAL_API_TOKEN);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new AppError('FORBIDDEN', 'Internal endpoint');
    }
    return true;
  }
}

/** Applies a provider event once: the webhook row's unique event ID is the dedupe boundary. */
@Injectable()
export class ProviderEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async ingest(
    event: ProviderEvent,
    rawBody: string,
    signatureValid: boolean,
  ): Promise<'applied' | 'duplicate' | 'rejected'> {
    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.$executeRaw`
        INSERT INTO webhook_events (id, provider_event_id, event_type, raw_body, signature_valid, received_at)
        VALUES (${uuidv7()}::uuid, ${event.eventId}, ${event.type === 'ignored' ? event.providerType : event.type}, ${rawBody}, ${signatureValid}, now())
        ON CONFLICT (provider_event_id) DO NOTHING`;
      if (inserted === 0) return 'duplicate';
      if (!signatureValid) return 'rejected';
      await this.orders.apply(event, tx);
      await tx.webhookEvent.update({
        where: { providerEventId: event.eventId },
        data: { processedAt: new Date() },
      });
      return 'applied';
    });
  }
}

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly events: ProviderEventsService,
    private readonly provider: PaymentProvider,
    private readonly wallet: WalletService,
    private readonly reconciliation: ReconciliationService,
    @Inject(ENV) private readonly env: PaymentEnv,
  ) {}

  @Public()
  @UseGuards(InternalGuard)
  @Post('internal/orders')
  @HttpCode(200)
  createOrder(@Body(new ZodPipe(createOrderSchema)) body: CreateOrderInput) {
    return this.orders.create(body);
  }

  @Public()
  @UseGuards(InternalGuard)
  @Post('internal/reconciliation/run')
  @HttpCode(200)
  reconcile() {
    return this.reconciliation.run();
  }

  /** FR-PY-02: signature verified over the raw body before anything is parsed or trusted. */
  @Public()
  @Post('v1/payments/webhook/razorpay')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    const raw = req.rawBody;
    if (!raw) throw new AppError('VALIDATION_FAILED', 'Empty body');
    const valid = this.provider.verifyWebhook(raw, signature);
    let event: ProviderEvent;
    try {
      event = valid
        ? this.provider.parseWebhook(raw, eventId)
        : { eventId: `unverified:${uuidv7()}`, type: 'ignored', providerType: 'unverified' };
    } catch {
      throw new AppError('VALIDATION_FAILED', 'Unreadable webhook');
    }
    const outcome = await this.events.ingest(event, raw.toString('utf8'), valid);
    if (outcome === 'rejected') {
      this.logger.warn({ eventId }, 'Webhook signature invalid; stored and ignored');
      throw new AppError('WEBHOOK_SIGNATURE_INVALID', 'Invalid signature');
    }
    return { status: outcome };
  }

  @Get('v1/wallet')
  summary(@CurrentUser() user: AuthUser) {
    return this.wallet.summary(user.id);
  }

  @Get('v1/wallet/transactions')
  history(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(walletHistoryQuerySchema)) q: WalletHistoryQuery,
  ) {
    return this.wallet.history(user.id, q);
  }

  /** Development only: completes a fake checkout (the mobile app's "test payment" sheet). */
  @Post('v1/payments/dev/simulate')
  @HttpCode(200)
  async simulate(@Body(new ZodPipe(simulatePaymentSchema)) body: SimulatePaymentInput) {
    if (!(this.provider instanceof FakeProvider) || this.env.NODE_ENV === 'production') {
      throw new AppError('NOT_FOUND', 'Not found');
    }
    const event = this.provider.simulate(body.providerOrderId, body.outcome);
    return { status: await this.events.ingest(event, JSON.stringify(event), true) };
  }
}
