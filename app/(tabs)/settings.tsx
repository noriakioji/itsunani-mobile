import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function SettingsScreen() {
  const debugUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/api/debug-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();
      console.log('User debug data:', JSON.stringify(data, null, 2));
      Alert.alert('Debug Info', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            // Clear Google tokens
            await SecureStore.deleteItemAsync('google_provider_token');
            await SecureStore.deleteItemAsync('google_provider_refresh_token');
            
            // Sign out from Supabase
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      <View style={styles.section}>
        <Button title="Debug User Info" onPress={debugUser} />
      </View>

      <View style={styles.section}>
        <Button title="Sign Out" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginTop: 20,
  },
});