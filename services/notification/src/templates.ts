import {
  type EventEnvelope,
  formatInr,
  type NotificationTarget,
  type NotificationType,
} from '@feedants/shared';
import { parseEvent } from '@feedants/server-kit';

export interface Draft {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  target: NotificationTarget | null;
}

const competition = (competitionId: string): NotificationTarget => ({ screen: 'competition', competitionId });

/**
 * FR-NT-01: which domain events notify whom, and with what copy. Every payload is
 * self-contained, so this never calls another service. English only in the MVP; the copy
 * lives here, in one place, for localisation later.
 */
export function draftsFor(event: EventEnvelope): Draft[] {
  switch (event.type) {
    case 'registration.confirmed': {
      const p = parseEvent(event, 'registration.confirmed');
      return [
        {
          userId: p.creatorId,
          type: 'REGISTRATION_CONFIRMED',
          title: "You're in!",
          body: `Your spot in ${p.competitionTitle} is confirmed. Good luck!`,
          target: competition(p.competitionId),
        },
      ];
    }
    case 'payment.failed': {
      const p = parseEvent(event, 'payment.failed');
      const funding = p.purpose === 'PRIZE_FUNDING';
      return [
        {
          userId: p.payerId,
          type: 'PAYMENT_FAILED',
          title: 'Payment failed',
          body: funding
            ? `Funding your prize pool didn't go through: ${p.reason}. You can try again.`
            : `Your entry payment didn't go through: ${p.reason}. Your spot is held for a few minutes — try again.`,
          target: funding ? { screen: 'my-competitions' } : competition(p.competitionId),
        },
      ];
    }
    case 'payment.refunded': {
      const p = parseEvent(event, 'payment.refunded');
      return [
        {
          userId: p.payerId,
          type: 'REFUND_ISSUED',
          title: 'Refund issued',
          body: `${formatInr(p.amountPaise)} is on its way back to your original payment method.`,
          target: { screen: 'wallet' },
        },
      ];
    }
    case 'competition.published': {
      const p = parseEvent(event, 'competition.published');
      return [
        {
          userId: p.hostId,
          type: 'COMPETITION_PUBLISHED',
          title: "You're live!",
          body: `${p.title} is published and open to creators.`,
          target: competition(p.competitionId),
        },
      ];
    }
    case 'competition.registration_opened': {
      const p = parseEvent(event, 'competition.registration_opened');
      return p.subscriberUserIds.map((userId) => ({
        userId,
        type: 'REGISTRATION_OPENED' as const,
        title: 'Registration is open',
        body: `${p.title} is open — join before the spots run out.`,
        target: competition(p.competitionId),
      }));
    }
    case 'competition.cancelled': {
      const p = parseEvent(event, 'competition.cancelled');
      return p.confirmedRegistrations.map((r) => ({
        userId: r.creatorId,
        type: 'COMPETITION_CANCELLED' as const,
        title: 'Competition cancelled',
        body: r.orderId
          ? `${p.title} was cancelled by its host. Your entry fee will be refunded in full.`
          : `${p.title} was cancelled by its host.`,
        target: competition(p.competitionId),
      }));
    }
    case 'competition.results_published': {
      const p = parseEvent(event, 'competition.results_published');
      const results = p.allRegistrationCreatorIds.map((userId) => ({
        userId,
        type: 'RESULTS_PUBLISHED' as const,
        title: 'Results are out',
        body: `See where you placed in ${p.title}.`,
        target: { screen: 'leaderboard', competitionId: p.competitionId } as NotificationTarget,
      }));
      const prizes = p.winners.map((w) => ({
        userId: w.creatorId,
        type: 'PRIZE_WON' as const,
        title: 'You won! 🏆',
        body: `You placed #${w.rank} in ${p.title} and won ${formatInr(w.amountPaise)}. It's in your wallet.`,
        target: { screen: 'wallet' } as NotificationTarget,
      }));
      return [...results, ...prizes];
    }
    default:
      return [];
  }
}

export const NOTIFYING_EVENTS = [
  'registration.confirmed',
  'payment.failed',
  'payment.refunded',
  'competition.published',
  'competition.registration_opened',
  'competition.cancelled',
  'competition.results_published',
];
