/**
 * Payment Routes for Global Bet
 * Handles deposit requests and payment status checks
 */

const express = require('express');
const router = express.Router();
const { initiatePayment } = require('../services/paymentService.js');
const supabase = require('../services/database.js');
const paymentCache = require('../services/paymentCache.js');
const {
  initiateAdminTestStkPush,
  normalizeDarajaPhoneNumber,
  queryAdminTestStkPushStatus,
} = require('../services/darajaTestService.js');
const {
  registerUserDarajaAttempt,
  ensureUserDarajaFunding,
  persistUserDarajaTerminalStatus,
} = require('../services/userDarajaFundingService.js');
const { sendWithdrawalSms } = require('../services/smsService.js');

const TEST_MIN_DEPOSIT_AMOUNT = 500;
const TEST_ACTIVATION_FEE = 1000;
const TEST_PRIORITY_FEE = 399;

function interpretUserDarajaStatus(result) {
  const code = `${result?.ResultCode ?? result?.resultCode ?? result?.ResponseCode ?? ''}`;
  const desc = `${result?.ResultDesc || result?.resultDesc || result?.ResponseDescription || ''}`;
  if (code === '0') return 'success';
  if (code === '1032' || /cancel|insufficient\s*funds|balance\s+is\s+insufficient/i.test(desc)) return 'cancelled';
  if (/process|pending|accept|queue|initiated/i.test(desc)) return 'pending';
  return 'failed';
}

/**
 * Handle payment timeout - mark as failed if no callback after 10 seconds
 */
async function handlePaymentTimeout(externalReference, checkoutRequestId, paymentData) {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        console.log(`\n⏰ [TIMEOUT CHECK] Checking payment: ${externalReference}`);
        
        let currentPaymentStatus = 'PENDING';
        
        try {
          const { data, error } = await supabase
            .from('payments')
            .select('status')
            .eq('external_reference', externalReference)
            .single();
          
          if (!error && data) {
            currentPaymentStatus = data.status;
          }
        } catch (dbError) {
          console.warn('⚠️ Timeout check DB error:', dbError.message);
          const cachedPayment = paymentCache.getPayment(externalReference);
          if (cachedPayment) {
            currentPaymentStatus = cachedPayment.status;
          }
        }

        if (currentPaymentStatus === 'PENDING') {
          console.log(`⏳ [TIMEOUT CHECK] Payment still pending after 10 seconds: ${externalReference}. Leaving as pending.`);
        } else {
          console.log(`✅ [TIMEOUT CHECK] Payment ${externalReference} has status: ${currentPaymentStatus} - No timeout needed\n`);
        }
        
        resolve();
      } catch (error) {
        console.error('❌ [TIMEOUT] Error in timeout handler:', error);
        resolve();
      }
    }, 10000);
  });
}

/**
 * POST /api/payments/initiate
 * Initiate a new payment
 */
router.post('/initiate', async (req, res) => {
  try {
    const { amount, phoneNumber, userId, paymentType, relatedWithdrawalId } = req.body;

    console.log('📋 Payment Initiation Request:', { amount, phoneNumber, userId, paymentType, relatedWithdrawalId });

    // Validation
    if (!amount || !phoneNumber || !userId) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Amount, phone number, and user ID are required'
      });
    }

    const numAmount = parseFloat(amount);
    const resolvedPaymentType = paymentType || 'deposit';
    const minDepositAmount = parseFloat(process.env.MIN_DEPOSIT_AMOUNT || `${TEST_MIN_DEPOSIT_AMOUNT}`);
    
    if (resolvedPaymentType === 'deposit' && numAmount < minDepositAmount) {
      console.log('❌ Validation failed: Deposit amount too low');
      return res.status(400).json({
        success: false,
        message: `Amount must be at least KSH ${minDepositAmount}`
      });
    }
    if (numAmount < 1) {
      return res.status(400).json({ success: false, message: 'Amount must be at least KSH 1' });
    }

    // Enforce minimum withdrawal amount
    if (resolvedPaymentType === 'withdrawal' && numAmount < 600) {
      console.log('❌ Validation failed: Withdrawal amount too low');
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is KSH 600'
      });
    }

    // If withdrawal, enforce only withdrawable_balance can be withdrawn (winnings)
    if (resolvedPaymentType === 'withdrawal') {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('withdrawable_balance, stakeable_balance')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.log('❌ Withdrawal failed: User not found');
        return res.status(400).json({
          success: false,
          message: 'User not found for withdrawal'
        });
      }

      const withdrawableBalance = parseFloat(user.withdrawable_balance || 0);
      const stakeableBalance = parseFloat(user.stakeable_balance || 0);
      
      if (withdrawableBalance < numAmount) {
        console.log('❌ Withdrawal failed: Insufficient withdrawable balance (winnings)');
        console.log(`   Requested: KSH ${numAmount}`);
        console.log(`   Withdrawable (winnings): KSH ${withdrawableBalance}`);
        console.log(`   Stakeable (deposits): KSH ${stakeableBalance} [Not withdrawal available]`);
        return res.status(400).json({
          success: false,
          message: 'Insufficient withdrawable balance (winnings only)',
          withdrawable_balance: withdrawableBalance,
          stakeable_balance: stakeableBalance,
          requested: numAmount
        });
      }

      // Deduct from withdrawable_balance only
      const newWithdrawableBalance = withdrawableBalance - numAmount;
      const newTotalBalance = stakeableBalance + newWithdrawableBalance;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ withdrawable_balance: newWithdrawableBalance, account_balance: newTotalBalance, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.log('❌ Withdrawal failed: Could not update withdrawable_balance');
        return res.status(500).json({
          success: false,
          message: 'Failed to update withdrawable balance for withdrawal',
          details: updateError.message
        });
      }
      
      console.log(`✅ Withdrawal deducted from withdrawable balance`);
      console.log(`   Withdrawable: KSH ${withdrawableBalance} → KSH ${newWithdrawableBalance}`);
    }

    // Generate reference
    const externalReference = `DEP-${Date.now()}-${userId}`;
    const baseCallbackUrl = (process.env.CALLBACK_URL || 'https://server-tau-puce.vercel.app').trim();
    const callbackUrl = `${baseCallbackUrl}/api/callbacks/payhero`;
    console.log('📡 Callback URL being sent to PayHero:', callbackUrl);

    console.log('🔄 Initiating payment with PayHero...');
    console.log('📞 Phone:', phoneNumber);
    console.log('💰 Amount:', numAmount);
    console.log('📝 Reference:', externalReference);

    // DEVELOPMENT MODE: Use mock payment for testing
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (isDevelopment && process.env.USE_MOCK_PAYMENTS === 'true') {
      console.log('🧪 [DEV MODE] Using mock payment processing...');
      
      // Create pending payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          user_id: userId,
          external_reference: externalReference,
          phone_number: phoneNumber,
          amount: numAmount,
          status: 'PENDING',
          payment_type: resolvedPaymentType,
          provider: 'MOCK',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (paymentError) {
        console.error('❌ Failed to create payment record:', paymentError);
      }

      // Cache the payment
      paymentCache.setPayment(externalReference, {
        status: 'PENDING',
        amount: numAmount,
        phoneNumber,
        userId,
        paymentType: resolvedPaymentType,
        createdAt: new Date().toISOString()
      });

      // Start timeout handler
      handlePaymentTimeout(externalReference, null, { amount: numAmount, phoneNumber, userId });

      return res.json({
        success: true,
        message: 'Payment initiated (mock mode)',
        external_reference: externalReference,
        checkout_id: `MOCK-${Date.now()}`,
        amount: numAmount,
        status: 'PENDING'
      });
    }

    // PRODUCTION: Call PayHero API
    const payheroParams = new URLSearchParams({
      amount: numAmount.toString(),
      phone: phoneNumber.replace(/^254/, '254'),
      reference: externalReference,
      callback_url: callbackUrl
    });

    const PAYHERO_URL = process.env.PAYHERO_URL || 'https://payhero.me/api/';
    const PAYHERO_KEY = process.env.PAYHERO_KEY || '';
    const PAYHERO_SECRET = process.env.PAYHERO_SECRET || '';

    console.log('📡 Sending request to PayHero...');
    
    const response = await fetch(`${PAYHERO_URL}checkout?token=${PAYHERO_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYHERO_SECRET}`
      },
      body: JSON.stringify({
        phone: phoneNumber.replace(/^254/, '254'),
        amount: numAmount,
        reference: externalReference,
        callback_url: callbackUrl
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ PayHero error:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.message || 'Payment initiation failed',
        error: responseData
      });
    }

    console.log('✅ PayHero response:', responseData);

    // Create pending payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        user_id: userId,
        external_reference: externalReference,
        phone_number: phoneNumber,
        amount: numAmount,
        status: 'PENDING',
        payment_type: resolvedPaymentType,
        provider: 'PAYHERO',
        checkout_id: responseData.checkout_id || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (paymentError) {
      console.error('❌ Failed to create payment record:', paymentError);
    }

    // Cache the payment
    paymentCache.setPayment(externalReference, {
      status: 'PENDING',
      amount: numAmount,
      phoneNumber,
      userId,
      paymentType: resolvedPaymentType,
      checkoutId: responseData.checkout_id,
      createdAt: new Date().toISOString()
    });

    // Start timeout handler
    handlePaymentTimeout(externalReference, responseData.checkout_id, { amount: numAmount, phoneNumber, userId });

    res.json({
      success: true,
      message: 'Payment initiated successfully',
      external_reference: externalReference,
      checkout_id: responseData.checkout_id,
      amount: numAmount,
      status: 'PENDING'
    });

  } catch (error) {
    console.error('❌ Payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
});

/**
 * GET /api/payments/status/:reference
 * Check payment status
 */
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    // Try to get from cache first
    const cachedPayment = paymentCache.getPayment(reference);
    
    if (cachedPayment) {
      console.log('📋 Payment found in cache:', reference);
      return res.json({
        success: true,
        external_reference: reference,
        status: cachedPayment.status,
        amount: cachedPayment.amount
      });
    }

    // Get from database
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('external_reference', reference)
      .single();

    if (error) {
      console.error('❌ Payment not found:', error);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      external_reference: reference,
      status: payment.status,
      amount: payment.amount,
      phone_number: payment.phone_number,
      created_at: payment.created_at
    });

  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
});

/**
 * POST /api/payments/callback
 * Handle payment callback from PayHero
 */
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('📥 Payment callback received:', callbackData);

    const { reference, status, amount } = callbackData;

    if (!reference) {
      console.error('❌ Callback missing reference');
      return res.status(400).json({ success: false, error: 'Reference required' });
    }

    // Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: status === 'completed' ? 'COMPLETED' : 'FAILED',
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('external_reference', reference);

    if (updateError) {
      console.error('❌ Failed to update payment status:', updateError);
    }

    // Update user balance if payment was successful
    if (status === 'completed') {
      const { data: payment } = await supabase
        .from('payments')
        .select('user_id, amount, payment_type')
        .eq('external_reference', reference)
        .single();

      if (payment) {
        // Update user balance
        const { data: user } = await supabase
          .from('users')
          .select('account_balance, stakeable_balance')
          .eq('id', payment.user_id)
          .single();

        if (user) {
          const currentBalance = parseFloat(user.account_balance || 0);
          const currentStakeable = parseFloat(user.stakeable_balance || 0);
          const newBalance = currentBalance + parseFloat(amount);
          const newStakeable = currentStakeable + parseFloat(amount);

          await supabase
            .from('users')
            .update({ 
              account_balance: newBalance,
              stakeable_balance: newStakeable,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.user_id);

          console.log(`✅ Balance updated for user ${payment.user_id}: ${currentBalance} → ${newBalance}`);
        }

        // Create transaction record
        await supabase
          .from('transactions')
          .insert([{
            user_id: payment.user_id,
            type: 'deposit',
            amount: parseFloat(amount),
            status: 'completed',
            phone_number: payment.phone_number,
            reference: reference,
            created_at: new Date().toISOString()
          }]);
      }
    }

    // Update cache
    paymentCache.setPayment(reference, {
      status: status === 'completed' ? 'COMPLETED' : 'FAILED',
      amount: parseFloat(amount),
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Callback error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/history/:userId
 * Get payment history for a user
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      payments: payments || []
    });
  } catch (error) {
    console.error('❌ Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Payment routes are running' });
});

module.exports = router;