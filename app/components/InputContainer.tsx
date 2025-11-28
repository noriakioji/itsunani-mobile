import { View, TextInput, TouchableOpacity, Image, Text, Keyboard, PanResponder } from 'react-native';
import { styles } from './InputContainer.styles';

interface InputContainerProps {
  textInput: string;
  onChangeText: (text: string) => void;
  imageUri: string | null;
  loading: boolean;
  canSend: boolean | string | null;
  onTakePhoto: () => void;
  onPickImage: () => void;
  onClearImage: () => void;
  onSend: () => void;
}

export function InputContainer({
  textInput,
  onChangeText,
  imageUri,
  loading,
  canSend,
  onTakePhoto,
  onPickImage,
  onClearImage,
  onSend,
}: InputContainerProps) {
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only activate on vertical swipe down
      return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
    },
    onPanResponderRelease: (_, gestureState) => {
      // If swiped down, dismiss keyboard
      if (gestureState.dy > 20) {
        Keyboard.dismiss();
      }
    },
  });

  return (
    <View style={styles.inputContainer} {...panResponder.panHandlers}>
      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onTakePhoto}
          disabled={loading}
        >
          <Text style={styles.actionIcon}>📸</Text>
          <Text style={styles.actionLabel}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onPickImage}
          disabled={loading}
        >
          <Text style={styles.actionIcon}>🖼️</Text>
          <Text style={styles.actionLabel}>Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Image Preview (if selected) */}
      {imageUri && !loading && (
        <View style={styles.selectedImageContainer}>
          <Image source={{ uri: imageUri }} style={styles.selectedImage} />
          <TouchableOpacity
            style={styles.removeImageButton}
            onPress={onClearImage}
          >
            <Text style={styles.removeImageText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Text"
          placeholderTextColor="#999"
          value={textInput}
          onChangeText={onChangeText}
          multiline
          maxLength={500}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
