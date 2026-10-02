// Imported first by main.ts: instrumentation must load before http, express, pg and ioredis.
import { startTracing } from '@feedants/server-kit/tracing';

startTracing('payment');
