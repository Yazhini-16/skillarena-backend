import { pool, withTransaction } from '../config/db.js';

const getWallet = async (userId) => {
  const result = await pool.query(
    `SELECT balance, locked_balance FROM wallets WHERE user_id = $1`,
    [userId]
  );
  if (!result.rows[0]) throw { statusCode: 404, message: 'Wallet not found' };
  return result.rows[0];
};

const getTransactionHistory = async (userId, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT id, type, amount, balance_after, description, reference_id, created_at
     FROM transactions WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
};

// Simulate a deposit (in production, this is called by Razorpay webhook)
const deposit = async (userId, amount) => {
  if (amount <= 0) throw { statusCode: 400, message: 'Amount must be positive' };

  return withTransaction(async (client) => {
    // Lock the row to prevent race conditions
    const walletResult = await client.query(
      `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    if (!walletResult.rows[0]) throw { statusCode: 404, message: 'Wallet not found' };

    const newBalance = parseFloat(walletResult.rows[0].balance) + amount;

    await client.query(
      `UPDATE wallets SET balance = $1, total_deposited = total_deposited + $2 WHERE user_id = $3`,
      [newBalance, amount, userId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description)
       VALUES ($1, 'DEPOSIT', $2, $3, 'Wallet top-up')`,
      [userId, amount, newBalance]
    );

    return { balance: newBalance };
  });
};

// Lock funds in escrow when joining a match — called before matchmaking
const lockFundsForMatch = async (userId, amount, matchId, client) => {
  const walletResult = await client.query(
    `SELECT balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  const wallet = walletResult.rows[0];
  if (!wallet) throw { statusCode: 404, message: 'Wallet not found' };
  if (parseFloat(wallet.balance) < amount) throw { statusCode: 400, message: 'Insufficient balance' };

  const newBalance = parseFloat(wallet.balance) - amount;
  const newLocked = parseFloat(wallet.locked_balance) + amount;

  await client.query(
    `UPDATE wallets SET balance = $1, locked_balance = $2 WHERE user_id = $3`,
    [newBalance, newLocked, userId]
  );

  await client.query(
    `INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
     VALUES ($1, 'MATCH_ENTRY_DEBIT', $2, $3, $4, 'Entry fee locked for match')`,
    [userId, amount, newBalance, matchId]
  );
};

// Release escrow — called when match ends
const releaseEscrowToWinner = async (winnerId, loserId, entryFee, matchId) => {
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || 10) / 100;
  const grossPrize = entryFee * 2;
  const platformFee = grossPrize * platformFeePercent;
  const netPrize = grossPrize - platformFee;

  return withTransaction(async (client) => {
    // Unlock loser's escrow (already deducted from balance, just clear locked)
    const loserWallet = await client.query(
      `SELECT locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [loserId]
    );
    const newLoserLocked = parseFloat(loserWallet.rows[0].locked_balance) - entryFee;
    await client.query(
      `UPDATE wallets SET locked_balance = $1 WHERE user_id = $2`,
      [newLoserLocked, loserId]
    );

    // Credit winner: unlock their escrow AND add the net prize
    const winnerWallet = await client.query(
      `SELECT balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [winnerId]
    );
    const newWinnerLocked = parseFloat(winnerWallet.rows[0].locked_balance) - entryFee;
    const newWinnerBalance = parseFloat(winnerWallet.rows[0].balance) + netPrize;

    await client.query(
      `UPDATE wallets SET balance = $1, locked_balance = $2, total_deposited = total_deposited + $3 WHERE user_id = $4`,
      [newWinnerBalance, newWinnerLocked, netPrize, winnerId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
       VALUES ($1, 'MATCH_WIN_CREDIT', $2, $3, $4, 'Match winnings')`,
      [winnerId, netPrize, newWinnerBalance, matchId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
       VALUES ($1, 'MATCH_LOSS_DEBIT', $2, (SELECT balance FROM wallets WHERE user_id=$1), $3, 'Match lost')`,
      [loserId, entryFee, matchId]
    );

    return { netPrize, platformFee };
  });
};

// Full refund — called if match is cancelled or Judge0 fails
const refundBothPlayers = async (playerAId, playerBId, entryFee, matchId) => {
  return withTransaction(async (client) => {
    for (const userId of [playerAId, playerBId]) {
      const walletResult = await client.query(
        `SELECT balance, locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      const wallet = walletResult.rows[0];
      const newBalance = parseFloat(wallet.balance) + entryFee;
      const newLocked = parseFloat(wallet.locked_balance) - entryFee;

      await client.query(
        `UPDATE wallets SET balance = $1, locked_balance = $2 WHERE user_id = $3`,
        [newBalance, newLocked, userId]
      );
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, 'REFUND', $2, $3, $4, 'Match cancelled - refund')`,
        [userId, entryFee, newBalance, matchId]
      );
    }
  });
};

export { getWallet, getTransactionHistory, deposit, lockFundsForMatch, releaseEscrowToWinner, refundBothPlayers };
