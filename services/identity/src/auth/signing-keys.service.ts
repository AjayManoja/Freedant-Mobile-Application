import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ENV } from '@feedants/server-kit';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  type JWK,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import type { IdentityEnv } from '../config';

/**
 * Holds the RS256 signing key and publishes the JWKS other services verify against.
 * The private key comes from SSM Parameter Store in production (never from the database
 * or the repository); development generates a throwaway key per boot.
 */
@Injectable()
export class SigningKeys implements OnModuleInit {
  private readonly logger = new Logger(SigningKeys.name);
  private privateKey!: Awaited<ReturnType<typeof importPKCS8>>;
  private publicJwks: JWK[] = [];
  private verifyKeys!: JWTVerifyGetKey;

  constructor(@Inject(ENV) private readonly env: IdentityEnv) {}

  async onModuleInit(): Promise<void> {
    const kid = this.env.JWT_KEY_ID;
    let current: JWK;
    if (this.env.JWT_PRIVATE_KEY) {
      const pem = this.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
      this.privateKey = await importPKCS8(pem, 'RS256');
      current = createPublicKey(createPrivateKey(pem)).export({ format: 'jwk' }) as JWK;
    } else {
      this.logger.warn('JWT_PRIVATE_KEY not set: using an ephemeral key (tokens die on restart)');
      const pair = await generateKeyPair('RS256', { extractable: true });
      this.privateKey = pair.privateKey;
      current = await exportJWK(pair.publicKey);
    }
    const previous = JSON.parse(this.env.JWT_PREVIOUS_PUBLIC_JWKS) as JWK[];
    this.publicJwks = [{ ...current, kid, alg: 'RS256', use: 'sig' }, ...previous];
    this.verifyKeys = createLocalJWKSet({ keys: this.publicJwks });
  }

  jwks(): { keys: JWK[] } {
    return { keys: this.publicJwks };
  }

  get keySet(): JWTVerifyGetKey {
    return this.verifyKeys;
  }

  async signAccessToken(userId: string, sessionId: string): Promise<{ token: string; expiresAt: Date }> {
    const ttl = this.env.ACCESS_TOKEN_TTL_SECONDS;
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'RS256', kid: this.env.JWT_KEY_ID, typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(this.env.JWT_ISSUER)
      .setAudience(this.env.JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .sign(this.privateKey);
    return { token, expiresAt: new Date((now + ttl) * 1000) };
  }
}
