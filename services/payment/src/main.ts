import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { configureHttp } from '@feedants/server-kit';
import { AppModule } from './app.module';
import { loadPaymentEnv } from './config';

async function bootstrap(): Promise<void> {
  const env = loadPaymentEnv();
  // rawBody: webhook signatures are verified over the exact bytes received.
  const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true, rawBody: true });
  configureHttp(app, { trustProxy: env.TRUST_PROXY, corsOrigins: env.CORS_ORIGINS });
  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
