import { Injectable } from '@nestjs/common';
import { AppError } from '@feedants/server-kit';
import type { AuthTokens, RequestOtpResponse, VerifyOtpResponse } from '@feedants/shared';
import { toMe, UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  /** Same response whether or not an account exists, so emails can't be enumerated. */
  requestCode(email: string, ip: string): Promise<RequestOtpResponse> {
    return this.otp.request(email, ip);
  }

  async verifyCode(
    email: string,
    code: string,
    ip: string,
    deviceLabel?: string,
  ): Promise<VerifyOtpResponse> {
    await this.otp.verify(email, code, ip);
    const { user } = await this.users.findOrCreateByEmail(email);
    if (user.status !== 'ACTIVE') throw new AppError('ACCOUNT_DELETED', 'This account has been deleted');
    const tokens = await this.tokens.startSession(user.id, deviceLabel);
    return { ...tokens, needsDisplayName: user.displayName === null, user: toMe(user) };
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (sessionId) await this.tokens.revokeFamily(sessionId);
  }
}
