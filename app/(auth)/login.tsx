import { useState, useEffect } from 'react';
import { View, Text, Button, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('🎬 LoginScreen mounted, setting up listeners...');
    
    // Check if we can get the initial URL
    Linking.getInitialURL().then(url => {
      console.log('Initial URL:', url);
      if (url) {
        handleUrl({ url });
      }
    });

    // Define handleUrl function
    const handleUrl = async (event: { url: string }) => {
      console.log('🔔 URL RECEIVED:', event.url);
      console.log('🔔 URL length:', event.url.length);
      
      try {
        const url = new URL(event.url);
        console.log('🔍 URL pathname:', url.pathname);
        console.log('🔍 URL hash:', url.hash);
        console.log('🔍 URL search:', url.search);
        
        // Get tokens from hash
        let access_token, refresh_token, provider_token;
        
        if (url.hash) {
          console.log('📦 Processing hash...');
          const hashParams = new URLSearchParams(url.hash.substring(1));
          access_token = hashParams.get('access_token');
          refresh_token = hashParams.get('refresh_token');
          provider_token = hashParams.get('provider_token');
          
          console.log('Tokens found:', {
            hasAccessToken: !!access_token,
            hasRefreshToken: !!refresh_token,
            hasProviderToken: !!provider_token,
          });
        } else {
          console.log('⚠️ No hash in URL');
        }
        
        if (access_token && refresh_token) {
          console.log('✅ Setting Supabase session...');
          
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          
          if (error) {
            console.error('❌ Error setting session:', error);
            Alert.alert('Error', error.message);
            setLoading(false);
            return;
          }
          
          console.log('✅ Session set successfully');
          
          // Store provider tokens
          if (provider_token) {
            console.log('💾 Storing Google provider tokens...');
            await SecureStore.setItemAsync('google_provider_token', provider_token);
            console.log('✅ Provider tokens stored');
          }
          
          console.log('🚀 Redirecting to tabs...');
          router.replace('/(tabs)');
          setLoading(false);
        } else {
          console.error('❌ No valid tokens found');
          setLoading(false);
        }
      } catch (error) {
        console.error('💥 Error processing URL:', error);
        setLoading(false);
      }
    };

    // Set up URL listener
    console.log('👂 Setting up URL listener...');
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🎯 URL listener triggered!');
      handleUrl(event);
    });

    // Listen for auth state changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event);
    });

    return () => {
      console.log('🧹 Cleaning up listeners...');
      subscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const redirectTo = 'itsunani://';
      
      console.log('🚀 Starting Google OAuth...');
      console.log('📍 Redirect URL:', redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          scopes: 'https://www.googleapis.com/auth/calendar',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        setLoading(false);
        throw error;
      }

      console.log('🌐 OAuth URL generated:', data.url);
      console.log('🌐 Opening browser...');

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      console.log('📊 Browser closed with result type:', result.type);
      
      if (result.type === 'success') {
        console.log('✅ Browser returned success');
        console.log('📱 Result URL:', result.url);
        
        // Manually call handleUrl since the listener might not fire
        await handleUrl({ url: result.url });
      } else if (result.type === 'cancel') {
        console.log('❌ User cancelled');
        setLoading(false);
      } else {
        console.log('⚠️ Unexpected result:', result);
        setLoading(false);
      }

    } catch (error: any) {
      console.error('❌ Login error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  // Make handleUrl accessible to signInWithGoogle
  const handleUrl = async (event: { url: string }) => {
    console.log('🔔 URL RECEIVED:', event.url);
    
    try {
      const url = new URL(event.url);
      
      let access_token, refresh_token, provider_token;
      
      if (url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        access_token = hashParams.get('access_token');
        refresh_token = hashParams.get('refresh_token');
        provider_token = hashParams.get('provider_token');
        
        console.log('Tokens found:', {
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
          hasProviderToken: !!provider_token,
        });
      }
      
      if (access_token && refresh_token) {
        console.log('✅ Setting Supabase session...');
        
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        
        if (error) {
          console.error('❌ Error setting session:', error);
          Alert.alert('Error', error.message);
          setLoading(false);
          return;
        }
        
        console.log('✅ Session set successfully');
        
        if (provider_token) {
          console.log('💾 Storing Google provider tokens...');
          await SecureStore.setItemAsync('google_provider_token', provider_token);
          console.log('✅ Provider tokens stored');
        }
        
        console.log('🚀 Redirecting to tabs...');
        router.replace('/(tabs)');
        setLoading(false);
      } else {
        console.error('❌ No valid tokens found');
        setLoading(false);
      }
    } catch (error) {
      console.error('💥 Error processing URL:', error);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Itsunani</Text>
      <Text style={styles.subtitle}>
        Never miss an event from screenshots
      </Text>
      
      {loading ? (
        <>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Signing in...</Text>
        </>
      ) : (
        <Button
          title="Sign in with Google"
          onPress={signInWithGoogle}
        />
      )}
      
      <Text style={styles.note}>
        We need access to your Google Calendar to save events
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  note: {
    marginTop: 20,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    maxWidth: 300,
  },
});