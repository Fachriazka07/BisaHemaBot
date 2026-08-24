import { supabase } from '../db/client';
import type { Wallet } from '../types';
import { extractEmoji, getDefaultEmojiForGoal } from '../utils/emoji';

// ─────────────────────────────────────────────────────────
// SAVINGS GOALS SERVICE
// ─────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  user_id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  emoji: string;
  created_at: string;
}

// READ
export async function getAllGoals(userId: number): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getAllGoals: ${error.message}`);
  return (data ?? []) as SavingsGoal[];
}

export async function findGoalByName(userId: number, name: string): Promise<SavingsGoal | null> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(1);

  if (error) throw new Error(`findGoalByName: ${error.message}`);
  return data && data.length > 0 ? (data[0] as SavingsGoal) : null;
}

export async function getGoalById(goalId: string): Promise<SavingsGoal | null> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (error || !data) return null;
  return data as SavingsGoal;
}

// CREATE
export async function createGoal(
  userId: number,
  rawName: string,
  targetAmount: number,
  deadline?: string,
  customEmoji?: string
): Promise<SavingsGoal> {
  const { emoji: extractedEmoji, cleanText } = extractEmoji(rawName);
  const name = cleanText.toLowerCase();

  const finalEmoji =
    customEmoji && customEmoji !== '🎯'
      ? customEmoji
      : extractedEmoji ?? getDefaultEmojiForGoal(name);

  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: userId,
      name,
      target_amount: targetAmount,
      current_amount: 0,
      deadline: deadline ?? null,
      emoji: finalEmoji,
    })
    .select()
    .single();

  if (error) throw new Error(`createGoal: ${error.message}`);
  return data as SavingsGoal;
}

// UPDATE — Deposit with optional wallet deduction & transaction logging
export async function depositToGoal(
  userId: number,
  goalId: string,
  amount: number,
  walletId?: string
): Promise<{ goal: SavingsGoal; wallet?: Wallet }> {
  const { data: goal, error: e1 } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (e1 || !goal) throw new Error('Goal tidak ditemukan.');

  let updatedWallet: Wallet | undefined;

  if (walletId) {
    const { data: wallet, error: e2 } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (e2 || !wallet) throw new Error('Dompet tidak ditemukan.');

    const newBalance = Number(wallet.balance) - amount;
    const { data: wData, error: e3 } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId)
      .select()
      .single();

    if (e3) throw new Error(`Gagal update saldo dompet: ${e3.message}`);
    updatedWallet = wData as Wallet;

    // Record transaction history
    await supabase.from('transactions').insert({
      user_id: userId,
      wallet_id: walletId,
      amount,
      type: 'expense',
      description: `Setor ke goal: ${goal.emoji} ${goal.name}`,
    });
  }

  const newCurrentAmount = Number(goal.current_amount) + amount;
  const { data: gData, error: e4 } = await supabase
    .from('savings_goals')
    .update({ current_amount: newCurrentAmount })
    .eq('id', goalId)
    .select()
    .single();

  if (e4) throw new Error(`Gagal update goal: ${e4.message}`);

  return { goal: gData as SavingsGoal, wallet: updatedWallet };
}

// UPDATE — Withdraw from Goal back to Wallet
export async function withdrawFromGoal(
  userId: number,
  goalId: string,
  amount: number,
  walletId?: string
): Promise<{ goal: SavingsGoal; wallet?: Wallet }> {
  const { data: goal, error: e1 } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (e1 || !goal) throw new Error('Goal tidak ditemukan.');

  if (Number(goal.current_amount) < amount) {
    throw new Error(`Saldo goal (${goal.current_amount}) tidak cukup untuk ditarik ${amount}.`);
  }

  let updatedWallet: Wallet | undefined;

  if (walletId) {
    const { data: wallet, error: e2 } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (e2 || !wallet) throw new Error('Dompet tidak ditemukan.');

    const newBalance = Number(wallet.balance) + amount;
    const { data: wData, error: e3 } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId)
      .select()
      .single();

    if (e3) throw new Error(`Gagal update saldo dompet: ${e3.message}`);
    updatedWallet = wData as Wallet;

    // Record income transaction history
    await supabase.from('transactions').insert({
      user_id: userId,
      wallet_id: walletId,
      amount,
      type: 'income',
      description: `Tarik dari goal: ${goal.emoji} ${goal.name}`,
    });
  }

  const newCurrentAmount = Number(goal.current_amount) - amount;
  const { data: gData, error: e4 } = await supabase
    .from('savings_goals')
    .update({ current_amount: newCurrentAmount })
    .eq('id', goalId)
    .select()
    .single();

  if (e4) throw new Error(`Gagal update goal: ${e4.message}`);

  return { goal: gData as SavingsGoal, wallet: updatedWallet };
}

// UPDATE — Set current_amount directly (fix mistyped deposit)
export async function updateGoalCurrentAmount(goalId: string, newAmount: number): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .update({ current_amount: newAmount })
    .eq('id', goalId)
    .select()
    .single();

  if (error) throw new Error(`updateGoalCurrentAmount: ${error.message}`);
  return data as SavingsGoal;
}

// UPDATE — general
export async function updateGoal(
  goalId: string,
  updates: Partial<Pick<SavingsGoal, 'name' | 'target_amount' | 'current_amount' | 'deadline' | 'emoji'>>
): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single();

  if (error) throw new Error(`updateGoal: ${error.message}`);
  return data as SavingsGoal;
}

// DELETE
export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId);
  if (error) throw new Error(`deleteGoal: ${error.message}`);
}
