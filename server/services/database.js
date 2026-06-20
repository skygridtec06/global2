/**
 * Database Service for Global Bet
 * Handles Supabase connection and common queries
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️ Supabase credentials not found. Using mock mode.');
}

// Helper function to execute queries with error handling
async function executeQuery(queryFn, operationName = 'query') {
  try {
    const result = await queryFn();
    return result;
  } catch (error) {
    console.error(`❌ ${operationName} error:`, error.message);
    throw error;
  }
}

// User operations
const userOperations = {
  async getUserById(userId) {
    return executeQuery(
      () => supabase?.from('users').select('*').eq('id', userId).single(),
      'getUserById'
    );
  },

  async getUserByPhone(phoneNumber) {
    return executeQuery(
      () => supabase?.from('users').select('*').eq('phone_number', phoneNumber).single(),
      'getUserByPhone'
    );
  },

  async updateUserBalance(userId, newBalance) {
    return executeQuery(
      () => supabase?.from('users').update({ 
        account_balance: newBalance,
        updated_at: new Date().toISOString()
      }).eq('id', userId),
      'updateUserBalance'
    );
  },

  async createUser(userData) {
    return executeQuery(
      () => supabase?.from('users').insert([userData]).select().single(),
      'createUser'
    );
  }
};

// Game operations
const gameOperations = {
  async getUpcomingGames(limit = 50) {
    return executeQuery(
      () => supabase?.from('games')
        .select('*')
        .eq('status', 'upcoming')
        .gte('time', new Date().toISOString())
        .order('time', { ascending: true })
        .limit(limit),
      'getUpcomingGames'
    );
  },

  async getLiveGames() {
    return executeQuery(
      () => supabase?.from('games')
        .select('*')
        .eq('status', 'live')
        .order('time', { ascending: true }),
      'getLiveGames'
    );
  },

  async getGameById(gameId) {
    return executeQuery(
      () => supabase?.from('games').select('*').eq('id', gameId).single(),
      'getGameById'
    );
  },

  async getGameByGameId(gameId) {
    return executeQuery(
      () => supabase?.from('games').select('*').eq('game_id', gameId).single(),
      'getGameByGameId'
    );
  },

  async createGame(gameData) {
    return executeQuery(
      () => supabase?.from('games').insert([gameData]).select().single(),
      'createGame'
    );
  },

  async updateGame(gameId, updates) {
    return executeQuery(
      () => supabase?.from('games').update(updates).eq('id', gameId),
      'updateGame'
    );
  },

  async deleteGame(gameId) {
    return executeQuery(
      () => supabase?.from('games').delete().eq('id', gameId),
      'deleteGame'
    );
  }
};

// Market operations
const marketOperations = {
  async getMarketsByGameId(gameId) {
    return executeQuery(
      () => supabase?.from('markets')
        .select('*')
        .eq('game_id', gameId),
      'getMarketsByGameId'
    );
  },

  async createMarket(marketData) {
    return executeQuery(
      () => supabase?.from('markets').insert([marketData]).select().single(),
      'createMarket'
    );
  },

  async createMarkets(markets) {
    return executeQuery(
      () => supabase?.from('markets').insert(markets),
      'createMarkets'
    );
  }
};

// Bet operations
const betOperations = {
  async getBetsByUserId(userId, limit = 20) {
    return executeQuery(
      () => supabase?.from('bets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      'getBetsByUserId'
    );
  },

  async getBetById(betId) {
    return executeQuery(
      () => supabase?.from('bets').select('*').eq('id', betId).single(),
      'getBetById'
    );
  },

  async createBet(betData) {
    return executeQuery(
      () => supabase?.from('bets').insert([betData]).select().single(),
      'createBet'
    );
  },

  async updateBetStatus(betId, status) {
    return executeQuery(
      () => supabase?.from('bets').update({ status }).eq('id', betId),
      'updateBetStatus'
    );
  }
};

// Transaction operations
const transactionOperations = {
  async getTransactionsByUserId(userId, limit = 20) {
    return executeQuery(
      () => supabase?.from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      'getTransactionsByUserId'
    );
  },

  async createTransaction(transactionData) {
    return executeQuery(
      () => supabase?.from('transactions').insert([transactionData]).select().single(),
      'createTransaction'
    );
  }
};

// Payment operations
const paymentOperations = {
  async getPaymentByReference(reference) {
    return executeQuery(
      () => supabase?.from('payments')
        .select('*')
        .eq('external_reference', reference)
        .single(),
      'getPaymentByReference'
    );
  },

  async createPayment(paymentData) {
    return executeQuery(
      () => supabase?.from('payments').insert([paymentData]).select().single(),
      'createPayment'
    );
  },

  async updatePaymentStatus(reference, status) {
    return executeQuery(
      () => supabase?.from('payments')
        .update({ 
          status,
          completed_at: status === 'COMPLETED' ? new Date().toISOString() : null
        })
        .eq('external_reference', reference),
      'updatePaymentStatus'
    );
  }
};

module.exports = supabase;
module.exports.userOperations = userOperations;
module.exports.gameOperations = gameOperations;
module.exports.marketOperations = marketOperations;
module.exports.betOperations = betOperations;
module.exports.transactionOperations = transactionOperations;
module.exports.paymentOperations = paymentOperations;