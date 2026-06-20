// M-Pesa deposit service via PayHero (same API as BetNexa)

const API_URL = 'https://server-tau-puce.vercel.app';

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  if (/^0[1679]/.test(normalized)) {
    normalized = '254' + normalized.substring(1);
  } else if (!/^254/.test(normalized)) {
    normalized = '254' + normalized;
  }
  return normalized;
}

export interface DepositResult {
  success: boolean;
  externalReference?: string;
  message?: string;
}

export interface PaymentStatusResult {
  status: 'pending' | 'completed' | 'failed';
  payment?: any;
}

/**
 * Initiate M-Pesa STK Push deposit via PayHero
 */
export async function initiateDeposit(
  amount: number,
  phoneNumber: string,
  userId: string
): Promise<DepositResult> {
  const normalizedPhone = normalizePhone(phoneNumber);

  const response = await fetch(`${API_URL}/api/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      phoneNumber: normalizedPhone,
      userId,
      paymentType: 'activation',
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    return {
      success: false,
      message: data.message || 'Failed to initiate payment',
    };
  }

  const ref = data.data?.externalReference || data.externalReference;
  if (!ref) {
    return { success: false, message: 'No payment reference received' };
  }

  return { success: true, externalReference: ref };
}

/**
 * Check payment status by external reference
 */
export async function checkPaymentStatus(
  externalReference: string
): Promise<PaymentStatusResult> {
  try {
    const response = await fetch(
      `${API_URL}/api/payments/status/${encodeURIComponent(externalReference)}`
    );
    const data = await response.json();

    if (data.success && data.payment) {
      const status = data.payment.status;
      if (status === 'Success' || status === 'completed') {
        return { status: 'completed', payment: data.payment };
      }
      if (status === 'Failed' || status === 'failed') {
        return { status: 'failed', payment: data.payment };
      }
    }
    return { status: 'pending' };
  } catch {
    return { status: 'pending' };
  }
}

/**
 * Poll for payment completion with callbacks
 */
export function pollPaymentStatus(
  externalReference: string,
  onCompleted: (payment: any) => void,
  onFailed: () => void,
  onTimeout: () => void,
  intervalMs = 3000,
  maxAttempts = 100 // 5 minutes at 3s intervals
): () => void {
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const result = await checkPaymentStatus(externalReference);
      if (result.status === 'completed') {
        clearInterval(interval);
        onCompleted(result.payment);
      } else if (result.status === 'failed') {
        clearInterval(interval);
        onFailed();
      }
    } catch {
      // Continue polling
    }
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      onTimeout();
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}
