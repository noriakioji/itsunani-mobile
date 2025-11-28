import { Stack, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 Auth Layout - Initial session:', session?.user?.email || 'none');
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth Layout - Auth state changed:', event, session?.user?.email || 'none');
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // If logged in, redirect to tabs
  if (!loading && session) {
    console.log('✅ Auth Layout - Redirecting to tabs');
    return <Redirect href="/(tabs)" />;
  }

  console.log('📱 Auth Layout - Rendering auth screen, loading:', loading, 'hasSession:', !!session);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}