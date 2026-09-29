import { Body, Controller, Get, Header, HttpCode, Post, Req } from '@nestjs/common';
import { type AuthUser, CurrentUser, Public, RateLimit, ZodPipe } from '@feedants/server-kit';
import {
  type AuthTokens,
  type CompleteSignupInput,
  completeSignupSchema,
  type MeResponse,
  type RefreshTokenInput,
  refreshTokenSchema,
  type RequestOtpInput,
  requestOtpSchema,
  type RequestOtpResponse,
  type VerifyOtpInput,
  verifyOtpSchema,
  type VerifyOtpResponse,
} from '@feedants/shared';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SigningKeys } from './signing-keys.service';

const clientIp = (req: Request) => req.ip ?? 'unknown';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly keys: SigningKeys,
  ) {}

  @Public()
  @Post('v1/auth/otp/request')
  @HttpCode(200)
  requestOtp(
    @Body(new ZodPipe(requestOtpSchema)) body: RequestOtpInput,
    @Req() req: Request,
  ): Promise<RequestOtpResponse> {
    return this.auth.requestCode(body.email, clientIp(req));
  }

  @Public()
  @Post('v1/auth/otp/verify')
  @HttpCode(200)
  verifyOtp(
    @Body(new ZodPipe(verifyOtpSchema)) body: VerifyOtpInput,
    @Req() req: Request,
  ): Promise<VerifyOtpResponse> {
    return this.auth.verifyCode(body.email, body.code, clientIp(req), req.get('user-agent'));
  }

  @Post('v1/auth/complete-signup')
  @HttpCode(200)
  completeSignup(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(completeSignupSchema)) body: CompleteSignupInput,
  ): Promise<MeResponse> {
    return this.users.completeSignup(user.id, body.displayName);
  }

  @Public()
  @RateLimit({ name: 'refresh', limit: 60, windowSeconds: 60 })
  @Post('v1/auth/refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshTokenSchema)) body: RefreshTokenInput): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('v1/auth/logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logout(user.sessionId);
  }

  @Public()
  @Get('.well-known/jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  jwks() {
    return this.keys.jwks();
  }
}
