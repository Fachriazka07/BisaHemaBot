import { supabase } from '../db/client';

// ─────────────────────────────────────────────────────────
// REMINDER SERVICE
// ─────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  user_id: number;
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  created_at: string;
}

export async function getReminder(userId: number): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data as Reminder;
}

export async function upsertReminder(
  userId: number,
  hour: number,
  minute: number,
  enabled = true
): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .upsert(
      { user_id: userId, hour, minute, enabled, timezone: 'Asia/Jakarta' },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`upsertReminder: ${error.message}`);
  return data as Reminder;
}

export async function toggleReminder(userId: number, enabled: boolean): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .update({ enabled })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`toggleReminder: ${error.message}`);
  return data as Reminder;
}

/** Get all active reminders (for cron job to iterate) */
export async function getActiveReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('enabled', true);

  if (error) throw new Error(`getActiveReminders: ${error.message}`);
  return (data ?? []) as Reminder[];
}
