// services/payment.service.ts
//
// Fake payment stand-in. Randomly passes or fails, simulating a real
// payment provider's response. This file exists so Week 6 can swap in
// real payment/saga logic by changing only this one file — nothing that
// calls simulatePayment() needs to know it's fake.

const SUCCESS_RATE = 0.8; // 80% of payments "succeed"

export interface PaymentResult {
  success: boolean;
  reason?: string;
}

export async function simulatePayment(): Promise<PaymentResult> {
  const succeeded = Math.random() < SUCCESS_RATE;

  if (succeeded) {
    return { success: true };
  }

  return { success: false, reason: "Payment declined (simulated failure)" };
}
