import { Inject, Injectable } from '@nestjs/common';
import { type AuthUser, ENV, TokenVerifier, verifyAccessToken } from '@feedants/server-kit';
import type { IdentityEnv } from '../config';
import { SigningKeys } from './signing-keys.service';

/** Identity verifies its own tokens with its in-memory key set instead of fetching its own JWKS. */
@Injectable()
export class LocalTokenVerifier extends TokenVerifier {
  constructor(
    private readonly keys: SigningKeys,
    @Inject(ENV) private readonly env: IdentityEnv,
  ) {
    super();
  }

  verify(token: string): Promise<AuthUser> {
    return verifyAccessToken(token, this.keys.keySet, {
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
    });
  }
}
