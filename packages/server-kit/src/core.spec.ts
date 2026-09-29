import { Controller, Get, INestApplication, Module, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWTVerifyGetKey } from 'jose';
import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { z } from 'zod';
import {
  AuthUser,
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  TokenVerifier,
  verifyAccessToken,
} from './auth';
import { CoreModule } from './core.module';
import { AppError } from './errors';
import { configureHttp } from './http';
import { RateLimit } from './rate-limit';
import { REDIS } from './redis';
import { ZodPipe } from './validation';
import { uuidv7 } from './ids';

const ISSUER = 'feedants-identity';
const AUDIENCE = 'feedants';
let keys: JWTVerifyGetKey;
let sign: (sub: string, opts?: { exp?: string; aud?: string }) => Promise<string>;

class LocalVerifier extends TokenVerifier {
  verify(token: string): Promise<AuthUser> {
    return verifyAccessToken(token, keys, { issuer: ISSUER, audience: AUDIENCE });
  }
}

@Controller()
class TestController {
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id };
  }

  @OptionalAuth()
  @Get('maybe')
  maybe(@MaybeUser() user?: AuthUser) {
    return { id: user?.id ?? null };
  }

  @Public()
  @RateLimit({ name: 'test', limit: 2, windowSeconds: 60 })
  @Get('limited')
  limited() {
    return { ok: true };
  }

  @Public()
  @Post('echo')
  echo(@Body(new ZodPipe(z.strictObject({ name: z.string().min(2) }))) body: { name: string }) {
    return body;
  }

  @Public()
  @Get('boom')
  boom() {
    throw new Error('secret internal detail');
  }

  @Public()
  @Get('conflict')
  conflict() {
    throw new AppError('NO_SPOTS_LEFT', 'No spots left');
  }
}

@Module({
  imports: [
    CoreModule.forRoot({
      serviceName: 'test',
      logLevel: 'silent',
      redisUrl: 'redis://localhost:6379',
      tokenVerifier: { provide: TokenVerifier, useClass: LocalVerifier },
    }),
  ],
  controllers: [TestController],
})
class TestModule {}

describe('CoreModule HTTP stack', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    keys = createLocalJWKSet({ keys: [jwk] });
    sign = (sub, opts = {}) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setSubject(sub)
        .setIssuer(ISSUER)
        .setAudience(opts.aud ?? AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(opts.exp ?? '15m')
        .sign(privateKey);

    const moduleRef = await Test.createTestingModule({ imports: [TestModule] })
      .overrideProvider(REDIS)
      .useValue(new RedisMock())
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureHttp(app, { trustProxy: 'loopback', corsOrigins: [] });
    await app.init();
  });

  afterAll(() => app.close());

  it('rejects protected routes without a token in the standard error format', async () => {
    const res = await request(app.getHttpServer()).get('/me').expect(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('accepts a valid RS256 token', async () => {
    const id = uuidv7();
    const token = await sign(id);
    await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${token}`).expect(200, { id });
  });

  it('rejects expired tokens and tokens for another audience', async () => {
    const expired = await sign(uuidv7(), { exp: '-1m' });
    const wrongAud = await sign(uuidv7(), { aud: 'someone-else' });
    for (const t of [expired, wrongAud]) {
      await request(app.getHttpServer()).get('/me').set('Authorization', `Bearer ${t}`).expect(401);
    }
  });

  it('lets guests through optional-auth routes', async () => {
    await request(app.getHttpServer()).get('/maybe').expect(200, { id: null });
  });

  it('keeps a well-formed incoming request ID', async () => {
    const res = await request(app.getHttpServer()).get('/maybe').set('X-Request-Id', 'gateway-req-12345');
    expect(res.headers['x-request-id']).toBe('gateway-req-12345');
  });

  it('rate-limits with Retry-After', async () => {
    const server = app.getHttpServer();
    await request(server).get('/limited').expect(200);
    await request(server).get('/limited').expect(200);
    const res = await request(server).get('/limited').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('rejects unknown fields and invalid input', async () => {
    const res = await request(app.getHttpServer())
      .post('/echo')
      .send({ name: 'ok', admin: true })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    await request(app.getHttpServer()).post('/echo').send({ name: 'Riya' }).expect(201, { name: 'Riya' });
  });

  it('maps domain errors to their HTTP status', async () => {
    const res = await request(app.getHttpServer()).get('/conflict').expect(409);
    expect(res.body.error.code).toBe('NO_SPOTS_LEFT');
  });

  it('never leaks internal error details', async () => {
    const res = await request(app.getHttpServer()).get('/boom').expect(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL', message: 'Internal error' });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('returns 404 in the standard format for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('reports readiness from registered checks', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200);
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body.checks).toEqual({ redis: 'up' });
  });
});

describe('uuidv7', () => {
  it('is a valid, time-ordered UUID v7', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});
