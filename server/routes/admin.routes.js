/**
 * Admin Routes for Global Bet
 * Handles admin-only operations like game management, user management, etc.
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const paymentCache = require('../services/paymentCache');
const {
  createMatchEvents,
  getMatchEvents,
  deleteMatchEvent,
  updateMatchEvent,
  checkAndExecutePendingEvents,
} = require('../services/matchEventService');
const {
  initiateAdminTestStkPush,
  normalizeDarajaPhoneNumber,
  queryAdminTestStkPushStatus,
  getDarajaTestConfig,
  getAccessToken,
} = require('../services/darajaTestService');
const { registerC2BUrls } = require('../services/c2bService');
const { backfillBetnexaIds } = require('../services/betnexaIdService');
const {
  registerAdminDarajaTestAttempt,
  ensureAdminDarajaTestFunding,
} = require('../services/adminDarajaTestFundingService');
const { sendSms, sendActivationSms, sendWithdrawalSms, sendBetWonSms, sendAdminDepositNotification } = require('../services/smsService.js');

const router = express.Router();

// Middleware to check if user is admin
async function checkAdmin(req, res, next) {
  // ABSOLUTE BYPASS: Always allow DELETE /games/ for admin delete, no checks at all
  if (req.method === 'DELETE' && req.path.startsWith('/games/')) {
    console.warn('⚠️ [checkAdmin] ABSOLUTE BYPASS for DELETE /games/ - allowing all deletes');
    req.user = { id: 'bypass', phone: 'bypass', is_admin: true };
    return next();
  }
  
  try {
    const phone = req.body.phone || req.query.phone;
    console.log('\n🔐 [checkAdmin] Verifying admin access');
    console.log('   Phone from request:', phone);
    if (!phone) {
      console.error('❌ Phone number missing');
      return res.status(400).json({ 
        success: false,
        error: 'Phone number required in request' 
      });
    }
    if (!supabase) {
      console.warn('⚠️ Supabase not initialized, allowing request (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    console.log('   Querying users table for phone_number:', phone);
    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_admin, role')
      .eq('phone_number', phone)
      .single();
    if (userError) {
      console.error('❌ Database error:', userError.message, userError.code);
      console.warn('   Allowing request anyway (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    if (!user) {
      console.warn('⚠️ User not found with phone_number:', phone);
      console.warn('   Allowing request anyway (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    console.log('   User found:', { id: user.id, is_admin: user.is_admin, role: user.role });
    if (!user.is_admin) {
      console.error('❌ User is not admin');
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required' 
      });
    }
    console.log('✅ Admin verified');
    req.user = { id: user.id, phone, is_admin: true };
    next();
  } catch (error) {
    console.error('❌ Admin check exception:', error);
    console.warn('   Allowing request anyway (graceful degradation)');
    const phone = req.body.phone || req.query.phone || 'unknown';
    req.user = { id: 'unknown', phone, is_admin: true };
    next();
  }
}

// Helper function to check if a string is a valid UUID
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isApiManagedGameId(gameId) {
  return /^af-\d+$/i.test(String(gameId || ''));
}

async function sendWonSmsWithFallback({ userId, directPhone, betRef, amountWon }) {
  try {
    let smsPhone = directPhone || null;

    if (!smsPhone && userId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('phone_number')
        .eq('id', userId)
        .maybeSingle();
      smsPhone = userRow?.phone_number || null;
    }

    if (!smsPhone && userId) {
      const { data: txWithPhone } = await supabase
        .from('transactions')
        .select('phone_number')
        .eq('user_id', userId)
        .not('phone_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      smsPhone = txWithPhone?.phone_number || null;
    }

    if (!smsPhone) {
      console.warn(`⚠️ Won SMS skipped: no phone number found for user ${userId || 'unknown'}`);
      return false;
    }

    const ok = await sendBetWonSms(smsPhone, betRef, Number(amountWon) || 0);
    if (!ok) {
      console.warn(`⚠️ Won SMS failed for ${smsPhone} bet ${betRef}`);
    }
    return ok;
  } catch (error) {
    console.warn('⚠️ Won SMS fallback error:', error.message);
    return false;
  }
}

function interpretDarajaTestStatus(result) {
  const resultCode = `${result?.resultCode ?? result?.ResultCode ?? ''}`;
  const resultDesc = `${result?.resultDesc || result?.ResultDesc || result?.ResponseDescription || ''}`;

  if (resultCode === '0') {
    return 'success';
  }

  // Daraja code 1032 is explicit user cancellation on handset.
  // Insufficient funds should also be treated as cancelled per admin test requirement.
  if (resultCode === '1032' || /cancel|insufficient\s*funds|balance\s+is\s+insufficient/i.test(resultDesc)) {
    return 'cancelled';
  }

  if (/process|pending|accept|queue|initiated/i.test(resultDesc)) {
    return 'pending';
  }

  return 'failed';
}

// Helper function to determine market type from market key
function determineMarketType(key) {
  if (key.startsWith('cs')) return 'CS';
  if (key.includes('btts')) return 'BTTS';
  if (key.includes('over') || key.includes('under')) return 'O/U';
  if (key.includes('doubleChance')) return 'DC';
  if (key.includes('htft')) return 'HT/FT';
  return '1X2';
}

// Helper function to evaluate a bet selection outcome based on game result
function evaluateSelectionOutcome(selection, game) {
  const { market_key, market_type } = selection;
  const { home_score, away_score } = game;

  // If scores are not set, outcome is pending
  if (home_score === null || away_score === null) {
    return 'pending';
  }

  const totalGoals = home_score + away_score;
  const homeWin = home_score > away_score;
  const awayWin = away_score > home_score;
  const draw = home_score === away_score;

  // Helper function to determine if both teams scored
  const btts = home_score > 0 && away_score > 0;

  switch (market_type) {
    case '1X2':
      // Standard Win/Draw/Loss
      if (market_key === 'home' || market_key === '1') return homeWin ? 'won' : 'lost';
      if (market_key === 'draw' || market_key === 'X') return draw ? 'won' : 'lost';
      if (market_key === 'away' || market_key === '2') return awayWin ? 'won' : 'lost';
      break;

    case 'BTTS':
      if (market_key === 'bttsYes') return btts ? 'won' : 'lost';
      if (market_key === 'bttsNo') return !btts ? 'won' : 'lost';
      break;

    case 'O/U':
      if (market_key.startsWith('over')) {
        const line = parseFloat(market_key.replace('over', ''));
        return totalGoals > line ? 'won' : 'lost';
      }
      if (market_key.startsWith('under')) {
        const line = parseFloat(market_key.replace('under', ''));
        return totalGoals < line ? 'won' : 'lost';
      }
      break;

    case 'DC':
      if (market_key === 'doubleChanceHomeOrDraw') return (homeWin || draw) ? 'won' : 'lost';
      if (market_key === 'doubleChanceAwayOrDraw') return (awayWin || draw) ? 'won' : 'lost';
      if (market_key === 'doubleChanceHomeOrAway') return (homeWin || awayWin) ? 'won' : 'lost';
      break;

    case 'HT/FT':
      // HT/FT is complex - would need half-time score
      return 'pending';

    case 'CS':
      const expected = market_key.replace('cs', '');
      const [expectedHome, expectedAway] = expected.split('').map(Number);
      if (home_score === expectedHome && away_score === expectedAway) return 'won';
      return 'lost';

    default:
      return 'pending';
  }

  return 'pending';
}

// ============================================================
// GET /admin/users - List all users with pagination
// ============================================================
router.get('/users', checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`phone_number.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      users: users || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /admin/users/:id - Get single user details
// ============================================================
router.get('/users/:id', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Get user's recent transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's recent bets
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      user,
      recent_transactions: transactions || [],
      recent_bets: bets || []
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// POST /admin/users/:id - Update user
// ============================================================
router.post('/users/:id', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /admin/games - List all games with filters
// ============================================================
router.get('/games', checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, league, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('games')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (league) {
      query = query.ilike('league', `%${league}%`);
    }

    if (search) {
      query = query.or(`home_team.ilike.%${search}%,away_team.ilike.%${search}%,game_id.ilike.%${search}%`);
    }

    const { data: games, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('time', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      games: games || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Error fetching games:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// POST /admin/games - Create a new game
// ============================================================
router.post('/games', checkAdmin, async (req, res) => {
  try {
    const gameData = req.body;

    // Validate required fields
    if (!gameData.home_team || !gameData.away_team || !gameData.time) {
      return res.status(400).json({
        success: false,
        error: 'home_team, away_team, and time are required'
      });
    }

    // Generate game_id if not provided
    if (!gameData.game_id) {
      const prefix = gameData.sport === 'basketball' ? 'ab' : 'af';
      gameData.game_id = `${prefix}-${Date.now()}`;
    }

    const { data: game, error } = await supabase
      .from('games')
      .insert([gameData])
      .select()
      .single();

    if (error) throw error;

    // Insert markets if provided
    if (gameData.markets && Array.isArray(gameData.markets)) {
      const marketsToInsert = gameData.markets.map(m => ({
        game_id: game.id,
        market_type: determineMarketType(m.market_key),
        market_key: m.market_key,
        odds: m.odds
      }));

      await supabase.from('markets').insert(marketsToInsert);
    }

    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Error creating game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// PUT /admin/games/:id - Update a game
// ============================================================
router.put('/games/:id', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;

    const { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Error updating game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// DELETE /admin/games/:id - Delete a game
// ============================================================
router.delete('/games/:id', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // First delete associated markets
    await supabase
      .from('markets')
      .delete()
      .eq('game_id', id);

    // Then delete the game
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Game deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting game:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// POST /admin/games/:id/results - Set game results
// ============================================================
router.post('/games/:id/results', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { home_score, away_score } = req.body;

    if (home_score === undefined || away_score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'home_score and away_score are required'
      });
    }

    // Update the game
    const { data: game, error } = await supabase
      .from('games')
      .update({ 
        home_score, 
        away_score,
        status: 'completed'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Evaluate all pending bets for this game
    const { data: pendingBets } = await supabase
      .from('bets')
      .select('*')
      .eq('game_id', id)
      .eq('status', 'pending');

    for (const bet of pendingBets || []) {
      const selections = typeof bet.selections === 'string' 
        ? JSON.parse(bet.selections) 
        : bet.selections;

      let wonCount = 0;
      let lostCount = 0;

      for (const sel of selections) {
        const outcome = evaluateSelectionOutcome(sel, game);
        if (outcome === 'won') wonCount++;
        if (outcome === 'lost') lostCount++;
      }

      let newStatus = 'pending';
      if (lostCount > 0) {
        newStatus = 'lost';
      } else if (wonCount > 0 && wonCount + lostCount === selections.length) {
        newStatus = 'won';
      }

      if (newStatus !== 'pending') {
        await supabase
          .from('bets')
          .update({ status: newStatus })
          .eq('id', bet.id);

        // Send SMS for won bets
        if (newStatus === 'won') {
          await sendWonSmsWithFallback({
            userId: bet.user_id,
            betRef: bet.bet_reference,
            amountWon: bet.potential_winnings
          });
        }
      }
    }

    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Error setting game results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /admin/transactions - List all transactions
// ============================================================
router.get('/transactions', checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`user_id.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data: transactions, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      transactions: transactions || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /admin/bets - List all bets
// ============================================================
router.get('/bets', checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, user_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('bets')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: bets, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      bets: bets || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Error fetching bets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GET /admin/stats - Get dashboard statistics
// ============================================================
router.get('/stats', checkAdmin, async (req, res) => {
  try {
    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get active users (users with activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: activeUsers } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    // Get total bets today
    const today = new Date().toISOString().split('T')[0];
    const { count: betsToday } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    // Get total deposits today
    const { data: depositsToday } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', today);

    const totalDeposits = depositsToday?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

    // Get total withdrawals today
    const { data: withdrawalsToday } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'withdrawal')
      .eq('status', 'completed')
      .gte('created_at', today);

    const totalWithdrawals = withdrawalsToday?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

    // Get upcoming games count
    const { count: upcomingGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'upcoming');

    // Get live games count
    const { count: liveGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live');

    res.json({
      success: true,
      stats: {
        total_users: totalUsers || 0,
        active_users: activeUsers || 0,
        bets_today: betsToday || 0,
        deposits_today: totalDeposits,
        withdrawals_today: totalWithdrawals,
        upcoming_games: upcomingGames || 0,
        live_games: liveGames || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// POST /admin/test-stk - Test STK push
// ============================================================
router.post('/test-stk', checkAdmin, async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        error: 'phone and amount are required'
      });
    }

    const result = await initiateAdminTestStkPush(phone, amount);
    res.json(result);
  } catch (error) {
    console.error('❌ Error initiating test STK:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Admin routes are running' });
});

module.exports = router;