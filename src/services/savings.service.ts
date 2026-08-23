import { supabase } from '../db/client';

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

// CREATE
export async function createGoal(
  userId: number,
  name: string,
  targetAmount: number,
  deadline?: string,
  emoji = '🎯'
): Promise<SavingsGoal> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: userId,
      name,
      target_amount: targetAmount,
      current_amount: 0,
      deadline: deadline ?? null,
      emoji,
    })
    .select()
    .single();

  if (error) throw new Error(`createGoal: ${error.message}`);
  return data as SavingsGoal;
}

// UPDATE — add deposit
export async function addDeposit(goalId: string, amount: number): Promise<SavingsGoal> {
  // Get current
  const { data: goal, error: e1 } = await supabase
    .from('savings_goals')
    .select('current_amount')
    .eq('id', goalId)
    .single();

  if (e1 || !goal) throw new Error('Goal tidak ditemukan.');

  const newAmount = Number(goal.current_amount) + amount;

  const { data, error } = await supabase
    .from('savings_goals')
    .update({ current_amount: newAmount })
    .eq('id', goalId)
    .select()
    .single();

  if (error) throw new Error(`addDeposit: ${error.message}`);
  return data as SavingsGoal;
}

// UPDATE — general
export async function updateGoal(
  goalId: string,
  updates: Partial<Pick<SavingsGoal, 'name' | 'target_amount' | 'deadline' | 'emoji'>>
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
