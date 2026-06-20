/**
 * Payment Cache Service for Global Bet
 * In-memory cache for payment status tracking
 */

class PaymentCache {
  constructor() {
    this.payments = new Map();
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  setPayment(reference, paymentData) {
    this.payments.set(reference, {
      ...paymentData,
      cachedAt: new Date().toISOString()
    });
    console.log(`💾 Cached payment: ${reference}`, paymentData.status);
  }

  getPayment(reference) {
    const payment = this.payments.get(reference);
    
    if (!payment) {
      return null;
    }

    // Check if expired
    const cachedAt = new Date(payment.cachedAt).getTime();
    const now = Date.now();
    
    if (now - cachedAt > this.maxAge) {
      this.payments.delete(reference);
      console.log(`🗑️ Expired payment cache: ${reference}`);
      return null;
    }

    return payment;
  }

  updatePaymentStatus(reference, status) {
    const payment = this.payments.get(reference);
    
    if (payment) {
      payment.status = status;
      payment.updatedAt = new Date().toISOString();
      this.payments.set(reference, payment);
      console.log(`🔄 Updated payment status: ${reference} → ${status}`);
    }
  }

  deletePayment(reference) {
    this.payments.delete(reference);
    console.log(`🗑️ Deleted payment from cache: ${reference}`);
  }

  clearExpired() {
    const now = Date.now();
    let cleared = 0;

    for (const [reference, payment] of this.payments.entries()) {
      const cachedAt = new Date(payment.cachedAt).getTime();
      
      if (now - cachedAt > this.maxAge) {
        this.payments.delete(reference);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`🗑️ Cleared ${cleared} expired payments from cache`);
    }
  }

  getAllPayments() {
    return Array.from(this.payments.entries()).map(([reference, payment]) => ({
      reference,
      ...payment
    }));
  }

  getPaymentsByStatus(status) {
    return Array.from(this.payments.entries())
      .filter(([_, payment]) => payment.status === status)
      .map(([reference, payment]) => ({
        reference,
        ...payment
      }));
  }
}

// Export singleton instance
const paymentCache = new PaymentCache();

// Clear expired payments every hour
setInterval(() => {
  paymentCache.clearExpired();
}, 60 * 60 * 1000);

module.exports = paymentCache;