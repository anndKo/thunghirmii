// @ts-nocheck
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  gender: string;
  birth_date: string | null;
  region: string;
  bio: string;
  hobbies: string[];
  avatar_url: string | null;
  search_status: string | null;
  search_code: string | null;
  is_online: boolean;
  last_online: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) setProfile(data as Profile);
  };

  const setOnlineStatus = async (userId: string, online: boolean) => {
    await supabase
      .from("profiles")
      .update({ is_online: online, last_online: new Date().toISOString() })
      .eq("user_id", userId);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          // Don't await - fire and forget to avoid blocking auth flow
          fetchProfile(session.user.id).catch(console.error);
          setOnlineStatus(session.user.id, true).catch(console.error);
        } else {
          if (user) setOnlineStatus(user.id, false).catch(console.error);
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id).catch(console.error);
        setOnlineStatus(session.user.id, true).catch(console.error);
      }
      setLoading(false);
    });

    // Set offline on close
    const handleBeforeUnload = () => {
      if (user) {
        navigator.sendBeacon && setOnlineStatus(user.id, false);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const signOut = async () => {
    if (user) await setOnlineStatus(user.id, false);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
