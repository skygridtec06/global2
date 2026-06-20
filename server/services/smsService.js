/**
 * SMS Service for Global Bet
 * Handles sending SMS notifications to users
 */

// SMS configuration
const SMS_API_URL = process.env.SMS_API_URL || 'https://sms.smshub.co.ke/send';
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'GLOBALBET';

/**
 * Send SMS message
 * @param {string} phone - Phone number in format 254XXXXXXXXX
 * @param {string} message - Message to send
 * @returns {Promise<boolean>}
 */
async function sendSms(phone, message) {
  try {
    // Normalize phone number
    const normalizedPhone = phone.replace(/^0/, '254');
    
    console.log(`📱 Sending SMS to ${normalizedPhone}:`, message.substring(0, 50) + '...');

    // In development mode, just log
    if (process.env.NODE_ENV !== 'production' && process.env.USE_MOCK_SMS === 'true') {
      console.log('🧪 [DEV MODE] SMS would be sent:', message);
      return true;
    }

    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SMS_API_KEY}`
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message: message,
        sender_id: SMS_SENDER_ID
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ SMS API error:', error);
      return false;
    }

    const result = await response.json();
    console.log('✅ SMS sent successfully:', result);
    return true;
  } catch (error) {
    console.error('❌ SMS send error:', error);
    return false;
  }
}

/**
 * Send activation SMS
 * @param {string} phone - User's phone number
 * @param {string} betnexaId - User's Betnexa ID
 * @returns {Promise<boolean>}
 */
async function sendActivationSms(phone, betnexaId) {
  const message = `Welcome to GlobalBet! Your account ID is ${betnexaId}. Use this as the account number when depositing via M-Pesa. Deposit a minimum of KES 500 to activate your account.`;
  return sendSms(phone, message);
}

/**
 * Send deposit confirmation SMS
 * @param {string} phone - User's phone number
 * @param {number} amount - Deposit amount
 * @returns {Promise<boolean>}
 */
async function sendDepositSms(phone, amount) {
  const message = `GlobalBet: KES ${amount} has been credited to your account. Your balance is now active. Bet responsibly!`;
  return sendSms(phone, message);
}

/**
 * Send withdrawal SMS
 * @param {string} phone - User's phone number
 * @param {number} amount - Withdrawal amount
 * @returns {Promise<boolean>}
 */
async function sendWithdrawalSms(phone, amount) {
  const message = `GlobalBet: Your withdrawal of KES ${amount} has been initiated. It will be processed within 1-2 business days.`;
  return sendSms(phone, message);
}

/**
 * Send bet won SMS
 * @param {string} phone - User's phone number
 * @param {string} betRef - Bet reference
 * @param {number} amountWon - Amount won
 * @returns {Promise<boolean>}
 */
async function sendBetWonSms(phone, betRef, amountWon) {
  const message = `🎉 GlobalBet: Congratulations! Your bet #${betRef} won KES ${amountWon.toLocaleString()}. Your winnings have been added to your withdrawable balance.`;
  return sendSms(phone, message);
}

/**
 * Send bet lost SMS
 * @param {string} phone - User's phone number
 * @param {string} betRef - Bet reference
 * @returns {Promise<boolean>}
 */
async function sendBetLostSms(phone, betRef) {
  const message = `GlobalBet: Unfortunately, your bet #${betRef} did not win this time. Better luck next time!`;
  return sendSms(phone, message);
}

/**
 * Send admin deposit notification
 * @param {string} adminPhone - Admin's phone number
 * @param {string} userPhone - User's phone number
 * @param {number} amount - Deposit amount
 * @returns {Promise<boolean>}
 */
async function sendAdminDepositNotification(adminPhone, userPhone, amount) {
  const message = `🔔 GlobalBet Admin: User ${userPhone} has deposited KES ${amount}. Check admin panel for details.`;
  return sendSms(adminPhone, message);
}

/**
 * Send bet placement confirmation SMS
 * @param {string} phone - User's phone number
 * @param {string} betRef - Bet reference
 * @param {number} stake - Stake amount
 * @returns {Promise<boolean>}
 */
async function sendBetPlacedSms(phone, betRef, stake) {
  const message = `GlobalBet: Bet #${betRef} placed successfully. Stake: KES ${stake}. Good luck!`;
  return sendSms(phone, message);
}

module.exports = {
  sendSms,
  sendActivationSms,
  sendDepositSms,
  sendWithdrawalSms,
  sendBetWonSms,
  sendBetLostSms,
  sendAdminDepositNotification,
  sendBetPlacedSms
};