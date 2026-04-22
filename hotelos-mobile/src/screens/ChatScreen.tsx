import { useRef, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TextInput, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useChatWebSocket } from '../hooks/useChatWebSocket';

export function ChatScreen() {
  const { connected, typing, messages, send } = useChatWebSocket();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, typing]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={{ color: connected ? '#34C759' : '#FF3B30', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
          {connected ? 'AI Assistant is Online' : 'Connecting...'}
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.isUser ? styles.user : styles.bot]}>
            <Text style={{ color: '#FFFFFF', fontSize: 16 }}>{item.text}</Text>
            <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        )}
        ListFooterComponent={
          typing ? (
            <View style={[styles.bubble, styles.bot, { paddingVertical: 8, paddingHorizontal: 12, width: 60 }]}>
              <Text style={{ color: '#FFFFFF' }}>•••</Text>
            </View>
          ) : null
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="iMessage"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={text}
          onChangeText={setText}
          multiline
          onSubmitEditing={() => {
            if (text.trim()) { send(text); setText(''); }
          }}
        />
        <TouchableOpacity 
          style={[styles.sendButton, { opacity: !connected || !text.trim() ? 0.5 : 1 }]}
          disabled={!connected || !text.trim()}
          onPress={() => {
            send(text);
            setText('');
          }}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' }, // Deeper black for iMessage feel
  header: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: '#000000e6' },
  list: { padding: 16, paddingBottom: 32 },
  bubble: { 
    maxWidth: '75%', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20, // iMessage style rounded corners
    marginBottom: 12,
  },
  user: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#0A84FF', // iMessage Blue
    borderBottomRightRadius: 4, // Tail effect
  },
  bot: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#1C1C1E', // iMessage Dark Gray
    borderBottomLeftRadius: 4, // Tail effect
  },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, alignSelf: 'flex-end' },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    paddingBottom: 24, // Extra padding for home indicator
    backgroundColor: '#000000',
  },
  input: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  }
});
