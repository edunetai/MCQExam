import { supabase } from './supabase';

export const logAuditEvent = async (action: string, details?: object) => {
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Silently fail if user is not logged in (e.g., during sign-out)
    if (!user || !user.id || !user.email) {
        return;
    }

    const { error } = await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      details: details || {},
    });

    if (error) {
      console.error('Failed to log audit event. Action:', action, 'Error:', error.message, error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Exception while logging audit event. Action:', action, 'Error:', errorMessage, error);
  }
};
