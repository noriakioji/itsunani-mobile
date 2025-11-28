// itsunani-mobile/app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TabsLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📱 Tabs Layout - Initial session:', session?.user?.email || 'none');
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('📱 Tabs Layout - Auth state changed:', event, session?.user?.email || 'none');
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // If not logged in, redirect to login
  if (!loading && !session) {
    console.log('❌ Tabs Layout - No session, redirecting to login');
    return <Redirect href="/(auth)/login" />;
  }

  console.log('✅ Tabs Layout - Rendering tabs, loading:', loading, 'hasSession:', !!session);

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Extract Event',
          tabBarLabel: 'Extract'
        }} 
      />
      <Tabs.Screen 
        name="history" 
        options={{ 
          title: 'History',
          tabBarLabel: 'History'
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
          tabBarLabel: 'Settings'
        }} 
      />
    </Tabs>
  );
}