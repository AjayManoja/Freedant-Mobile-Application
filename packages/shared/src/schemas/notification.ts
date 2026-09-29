export type NotificationType =
  | 'REGISTRATION_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'REFUND_ISSUED'
  | 'COMPETITION_PUBLISHED'
  | 'REGISTRATION_OPENED'
  | 'RESULTS_PUBLISHED'
  | 'PRIZE_WON'
  | 'COMPETITION_CANCELLED';

/** FR-NT-03: where tapping the notification leads. */
export type NotificationTarget =
  | { screen: 'competition'; competitionId: string }
  | { screen: 'leaderboard'; competitionId: string }
  | { screen: 'wallet' }
  | { screen: 'my-competitions' };

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  target: NotificationTarget | null;
  read: boolean;
  createdAt: string;
}

export interface UnreadCount {
  unread: number;
}
