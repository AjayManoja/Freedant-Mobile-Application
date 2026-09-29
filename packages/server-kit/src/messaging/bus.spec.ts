import { InMemoryEventBus, matches } from './bus';
import { buildEvent } from './events';

describe('topic matching', () => {
  it.each([
    ['payment.captured', 'payment.captured', true],
    ['payment.*', 'payment.captured', true],
    ['payment.*', 'payment.captured.v2', false],
    ['competition.#', 'competition.results_published', true],
    ['#', 'anything.at.all', true],
    ['registration.confirmed', 'registration.held', false],
  ])('%s vs %s → %s', (pattern, key, expected) => {
    expect(matches(pattern, key)).toBe(expected);
  });
});

describe('InMemoryEventBus', () => {
  it('delivers only to subscribers whose routing keys match', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    await bus.subscribe({
      queue: 'q',
      routingKeys: ['user.updated'],
      handler: async (e) => void seen.push(e.type),
    });
    await bus.publish(
      buildEvent('identity', 'user.created', {
        userId: '0190f4c4-0000-7000-8000-000000000001',
        createdAt: new Date().toISOString(),
      }),
    );
    await bus.publish(
      buildEvent('identity', 'user.updated', {
        userId: '0190f4c4-0000-7000-8000-000000000001',
        displayName: 'Riya',
        avatarUrl: null,
      }),
    );
    await bus.deliverAll();
    expect(seen).toEqual(['user.updated']);
  });
});

describe('buildEvent', () => {
  it('rejects payloads that break the contract', () => {
    expect(() =>
      buildEvent('identity', 'user.updated', { userId: 'not-a-uuid', displayName: 'x', avatarUrl: null }),
    ).toThrow();
  });
});
