import { supabase } from '@/lib/supabase';
import { defaultAvatar } from '@/constants/app';

/**
 * Signs in as a guest: an anonymous account named "Player". Throws when guest
 * sign-in is unavailable.
 *
 * The metadata gets the SAME deterministic avatar the signup trigger already
 * wrote into profiles — a random seed here would leave the two disagreeing,
 * which is how guests ended up looking avatar-less.
 */
export async function signInAsGuest(): Promise<void> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (data.user) {
    await supabase.auth.updateUser({
      data: { username: 'Player', avatar_url: defaultAvatar(data.user.id) }
    });
  }
}
