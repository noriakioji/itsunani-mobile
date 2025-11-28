import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { router, Redirect } from 'expo-router';
import { registerForPushNotificationsAsync, sendLocalNotification } from '@/lib/notifications';
import { styles } from './index.styles';
import { InputContainer } from './components/InputContainer';
import { Calendar } from './components/Calendar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function HomeScreen() {
  const [session, setSession] = useState<any>(null);
  const [textInput, setTextInput] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    checkSession();
    
    // Register for push notifications (permissions only)
    registerForPushNotificationsAsync();

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      // Use remove() method on the subscription object
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setCheckingAuth(false);

    if (session?.user) {
      setUserId(session.user.id);
      loadQuota(session.user.id);
    }
  };

  const loadQuota = async (id?: string) => {
    const userIdToUse = id || userId;
    if (!userIdToUse) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('trial_events_remaining')
      .eq('id', userIdToUse)
      .single();

    if (profile) {
      setRemainingQuota(profile.trial_events_remaining);
    }
  };

  if (!checkingAuth && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (checkingAuth) {
    return null;
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const handleSend = async () => {
    if (!textInput.trim() && !imageBase64) {
      Alert.alert('Input Required', 'Please enter text or select an image');
      return;
    }

    Keyboard.dismiss();
    await extractAndSaveEvent();
  };

  const extractAndSaveEvent = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);

    try {
      console.log('🔍 Extracting event...');
      const extractResponse = await fetch(`${API_URL}/api/extract-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          imageBase64: imageBase64,
          text: textInput.trim() || null,
        }),
      });

      const extractData = await extractResponse.json();

      if (!extractResponse.ok) {
        Alert.alert('Extraction Failed', extractData.error);
        setLoading(false);
        return;
      }

      console.log('✅ Event extracted:', extractData.event.title);
      setRemainingQuota(extractData.remainingQuota);

      const providerToken = await SecureStore.getItemAsync('google_provider_token');
      const providerRefreshToken = await SecureStore.getItemAsync('google_provider_refresh_token');
      
      if (!providerToken) {
        Alert.alert(
          'Authentication Required',
          'Please sign out and sign in again to connect Google Calendar'
        );
        setLoading(false);
        return;
      }

      console.log('💾 Saving to calendar...');
      const saveResponse = await fetch(`${API_URL}/api/save-to-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          extractionId: extractData.extractionId,
          event: extractData.event,
          providerToken: providerToken,
          providerRefreshToken: providerRefreshToken,
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        if (saveResponse.status === 401) {
          Alert.alert(
            'Session Expired',
            'Please sign out and sign in again',
            [{ text: 'OK', onPress: () => router.push('/settings') }]
          );
        } else {
          Alert.alert('Save Failed', saveData.error);
        }
        setLoading(false);
        return;
      }

      console.log('✅ Saved to calendar');

      // Send push notification
      const eventTitle = extractData.event.title;
      const eventDate = new Date(extractData.event.startDate).toLocaleDateString();
      
      await sendLocalNotification(
        '✅ Event Added!',
        `"${eventTitle}" on ${eventDate} has been added to your calendar`
      );

      setTextInput('');
      setImageUri(null);
      setImageBase64(null);
      loadQuota();
      
    } catch (error: any) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to process event. Make sure your API server is running.');
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const canSend = (textInput.trim().length > 0 || imageBase64) && !loading;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
        {remainingQuota !== null && remainingQuota < 10 && (
          <View style={styles.quotaBadge}>
            <Text style={styles.quotaText}>{remainingQuota} left</Text>
          </View>
        )}
      </View>

      {/* Content Area */}
      <Calendar />

      {/* Input Area */}
      <InputContainer
        textInput={textInput}
        onChangeText={setTextInput}
        imageUri={imageUri}
        loading={loading}
        canSend={canSend}
        onTakePhoto={takePhoto}
        onPickImage={pickImage}
        onClearImage={clearImage}
        onSend={handleSend}
      />
    </KeyboardAvoidingView>
  );
}