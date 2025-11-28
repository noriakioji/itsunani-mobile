// itsunani-mobile/app/index.tsx
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  Alert, 
  StyleSheet, 
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { router, Redirect } from 'expo-router';

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

  useEffect(() => {
    checkSession();
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

      Alert.alert(
        '✅ Event Saved!',
        `"${extractData.event.title}" has been added to your Google Calendar.\n\n${extractData.remainingQuota} extractions remaining.`
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
        <Text style={styles.appName}>Itsunani</Text>
        {remainingQuota !== null && (
          <View style={styles.quotaBadge}>
            <Text style={styles.quotaText}>{remainingQuota} left</Text>
          </View>
        )}
      </View>

      {/* Content Area */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!loading && !imageUri && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Quick Event Capture</Text>
            <Text style={styles.emptySubtitle}>
              Type or upload event details to automatically add to your calendar
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            )}
            {textInput.trim() && !imageUri && (
              <View style={styles.textPreview}>
                <Text style={styles.textPreviewContent}>{textInput}</Text>
              </View>
            )}
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            <Text style={styles.loadingText}>Processing event...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={takePhoto}
            disabled={loading}
          >
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionLabel}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={pickImage}
            disabled={loading}
          >
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionLabel}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview (if selected) */}
        {imageUri && !loading && (
          <View style={styles.selectedImageContainer}>
            <Image source={{ uri: imageUri }} style={styles.selectedImage} />
            <TouchableOpacity 
              style={styles.removeImageButton} 
              onPress={clearImage}
            >
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Describe the event..."
            placeholderTextColor="#999"
            value={textInput}
            onChangeText={setTextInput}
            multiline
            maxLength={500}
            editable={!loading}
          />

          <TouchableOpacity 
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!canSend}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  settingsIcon: {
    fontSize: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  quotaBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  quotaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imagePreview: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  textPreview: {
    width: '100%',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
  },
  textPreviewContent: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  loader: {
    marginVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  selectedImageContainer: {
    position: 'relative',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#D0D0D0',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
});