import type { CompetitionSummary } from '@feedants/shared';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------- clock (A-15)

let clockOffsetMs = 0;
/** Corrects countdowns for a wrong device clock, from the server time on each detail load. */
export const syncServerClock = (serverTimeIso: string) => {
  clockOffsetMs = new Date(serverTimeIso).getTime() - Date.now();
};
export const serverNow = () => Date.now() + clockOffsetMs;

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** The deadline that matters to a visitor in each phase. */
export function deadlineFor(
  c: Pick<CompetitionSummary, 'phase' | 'registrationOpensAt' | 'registrationClosesAt' | 'submissionEndsAt'>,
) {
  switch (c.phase) {
    case 'UPCOMING':
      return { key: 'countdown.opensIn', at: c.registrationOpensAt };
    case 'OPEN':
      return { key: 'countdown.closesIn', at: c.registrationClosesAt };
    case 'SUBMISSIONS':
      return { key: 'countdown.submitIn', at: c.submissionEndsAt };
    default:
      return null;
  }
}
