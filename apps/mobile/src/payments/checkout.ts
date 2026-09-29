import type { CheckoutDetails } from '@feedants/shared';
import { Platform } from 'react-native';
import { api } from '@/api/client';

export type CheckoutOutcome = 'submitted' | 'dismissed' | 'failed';

/**
 * Opens the provider's hosted checkout (card data never touches the app, NFR-SC-06).
 * The outcome here is only a hint for the UI: the registration is confirmed solely by the
 * server once the signed webhook arrives (FR-PT-04), so the app then polls the registration.
 *
 * The fake provider (`rzp_test_fake`, local demos without Razorpay keys) is completed by the
 * in-app "test payment" sheet through `simulateFakePayment` instead.
 */
export const isFakeCheckout = (c: CheckoutDetails) => c.keyId === 'rzp_test_fake';

export async function simulateFakePayment(c: CheckoutDetails, outcome: 'captured' | 'failed'): Promise<void> {
  await api('/v1/payments/dev/simulate', {
    method: 'POST',
    body: { providerOrderId: c.providerOrderId, outcome },
  });
}

type RazorpayWindow = {
  Razorpay?: new (opts: Record<string, unknown>) => { open(): void; on(e: string, cb: () => void): void };
};

function loadWebCheckout(): Promise<void> {
  const w = globalThis as unknown as RazorpayWindow;
  if (w.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('checkout script failed'));
    document.body.appendChild(s);
  });
}

export async function openRazorpayCheckout(
  c: CheckoutDetails,
  prefill: { email?: string; name?: string },
  description: string,
): Promise<CheckoutOutcome> {
  if (Platform.OS !== 'web') {
    // The native SDK needs a development build (it isn't in Expo Go); see apps/mobile/README.md.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RazorpayCheckout = require('react-native-razorpay').default as {
        open(o: Record<string, unknown>): Promise<unknown>;
      };
      await RazorpayCheckout.open({
        key: c.keyId,
        order_id: c.providerOrderId,
        amount: c.amountPaise,
        currency: c.currency,
        name: 'Feedants',
        description,
        prefill,
        theme: { color: '#0d8074' },
      });
      return 'submitted';
    } catch (e) {
      const code = (e as { code?: number }).code;
      return code === 0 || code === 2 ? 'dismissed' : 'failed';
    }
  }
  await loadWebCheckout();
  const Razorpay = (globalThis as unknown as RazorpayWindow).Razorpay!;
  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: c.keyId,
      order_id: c.providerOrderId,
      amount: c.amountPaise,
      currency: c.currency,
      name: 'Feedants',
      description,
      prefill,
      theme: { color: '#0d8074' },
      handler: () => resolve('submitted'),
      modal: { ondismiss: () => resolve('dismissed') },
    });
    rzp.on('payment.failed', () => resolve('failed'));
    rzp.open();
  });
}
