import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Button, 
  Image, 
  TextInput, 
  Alert, 
  StyleSheet, 
  ScrollView,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function ExtractScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [event, setEvent] = useState<any>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getUserId();
    loadQuota();
  }, []);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadQuota = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('trial_events_remaining')
      .eq('id', user.id)
      .single();

    if (profile) {
      setRemainingQuota(profile.trial_events_remaining);
    }
  };

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
      setManualText('');
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
      setManualText('');
    }
  };

  const extractEvent = async () => {
    if (!imageBase64 && !manualText) {
      Alert.alert('Input required', 'Please add an image or enter text');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/extract-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          imageBase64: imageBase64,
          text: manualText || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error);
        return;
      }

      setEvent(data.event);
      setExtractionId(data.extractionId);
      setRemainingQuota(data.remainingQuota);
      
      Alert.alert(
        'Event Extracted!', 
        `${data.remainingQuota} extractions remaining`
      );
    } catch (error: any) {
      console.error('Extract error:', error);
      Alert.alert('Error', 'Failed to extract event. Make sure your API server is running on localhost:3000');
    } finally {
      setLoading(false);
    }
  };

  const saveToCalendar = async () => {
    if (!event || !extractionId || !userId) return;
    
    setLoading(true);
    try {
      // Get provider tokens from SecureStore
      const providerToken = await SecureStore.getItemAsync('google_provider_token');
      const providerRefreshToken = await SecureStore.getItemAsync('google_provider_refresh_token');
      
      console.log('=== Provider Token Debug ===');
      console.log('Has provider token:', !!providerToken);
      console.log('Has provider refresh token:', !!providerRefreshToken);
      console.log('Provider token (first 20):', providerToken?.substring(0, 20));
      console.log('==========================');
      
      if (!providerToken) {
        Alert.alert(
          'Authentication Required',
          'Please sign out and sign in again to connect Google Calendar',
          [
            { text: 'OK' }
          ]
        );
        return;
      }

      const response = await fetch(`${API_URL}/api/save-to-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          extractionId: extractionId,
          event: event,
          providerToken: providerToken,
          providerRefreshToken: providerRefreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          Alert.alert(
            'Session Expired',
            'Please sign out and sign in again',
            [
              { text: 'OK', onPress: () => router.push('/settings') }
            ]
          );
        } else {
          Alert.alert('Error', data.error);
        }
        return;
      }

      Alert.alert('Success!', 'Event saved to your Google Calendar');
      
      clearForm();
      loadQuota();
      
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setImageUri(null);
    setImageBase64(null);
    setManualText('');
    setEvent(null);
    setExtractionId(null);
  };

  const clearImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Extract Event</Text>
        {remainingQuota !== null && (
          <Text style={styles.quota}>
            {remainingQuota} extractions remaining
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capture Event</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>📸 Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>🖼️ Pick Image</Text>
          </TouchableOpacity>
        </View>

        {imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.image} />
            <TouchableOpacity style={styles.clearButton} onPress={clearImage}>
              <Text style={styles.clearButtonText}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.orText}>OR</Text>

        <TextInput
          placeholder="Paste event text here (e.g., 'Restaurant booking opens Dec 1st at 12pm')"
          value={manualText}
          onChangeText={setManualText}
          multiline
          style={styles.textInput}
          editable={!imageBase64}
        />

        <TouchableOpacity 
          style={[styles.extractButton, loading && styles.disabledButton]} 
          onPress={extractEvent}
          disabled={loading || (!imageBase64 && !manualText)}
        >
          <Text style={styles.extractButtonText}>
            {loading ? "Extracting..." : "Extract Event"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      )}

      {event && !loading && (
        <View style={styles.eventCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDetail}>
            📅 {new Date(event.startDate).toLocaleString()}
          </Text>
          {event.endDate && (
            <Text style={styles.eventDetail}>
              → {new Date(event.endDate).toLocaleString()}
            </Text>
          )}
          {event.location && (
            <Text style={styles.eventDetail}>📍 {event.location}</Text>
          )}
          {event.description && (
            <Text style={styles.eventDetail}>📝 {event.description}</Text>
          )}
          
          <View style={styles.eventActions}>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={saveToCalendar}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                Save to Calendar
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={clearForm}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  quota: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    marginVertical: 15,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 15,
    fontSize: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  extractButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  extractButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 20,
  },
  eventCard: {
    backgroundColor: '#f9f9f9',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  eventDetail: {
    fontSize: 15,
    color: '#555',
    marginBottom: 5,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});