import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearPushToken, registerPushToken } from './push';
import { supabase } from './supabase';
import type { Profile, Trainer } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  trainer: Trainer | null;   // per il trainer: sé stesso; per il cliente: il suo coach
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null, profile: null, trainer: null, loading: true,
  refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setTrainer(null); setLoading(false); return; }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile(p as Profile | null);
    if (p) {
      const trainerId = p.role === 'trainer' ? p.id
        : (await supabase.from('clients').select('trainer_id').eq('id', p.id).maybeSingle()).data?.trainer_id;
      if (trainerId) {
        const { data: t } = await supabase.from('trainers').select('*').eq('id', trainerId).maybeSingle();
        setTrainer(t as Trainer | null);
      }
      registerPushToken(p.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setLoading(true);
        // fuori dal callback per evitare blocchi del client Supabase
        setTimeout(() => load(s), 0);
      } else if (event === 'TOKEN_REFRESHED') setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value: AuthState = {
    session, profile, trainer, loading,
    refresh: () => load(session),
    signOut: async () => {
      if (profile) await clearPushToken(profile.id).catch(() => {});
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
