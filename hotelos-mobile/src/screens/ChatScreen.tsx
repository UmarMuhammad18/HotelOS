import { useRef, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, IconButton, Text, useTheme } from 'react-native-paper';
import { useChatWebSocket } from '../hooks/useChatWebSocket';

export function ChatScreen() {
  const theme = useTheme();
  const { connected, typing, messages, send } = useChatWebSocket();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, typing]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
        <Text style={{ color: connected ? '#4ade80' : '#f87171' }}>{connected ? '● Connected' : '○ Offline'}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.isUser ? styles.user : styles.bot]}>
            <Text style={{ color: '#e8eaf0' }}>{item.text}</Text>
            <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
          </View>
        )}
        ListFooterComponent={
          typing ? (
            <Text style={{ color: '#8892a4', margin: 8 }}>Agent is typing…</Text>
          ) : null
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={{ flex: 1, backgroundColor: '#0e1117' }}
          placeholder="Message…"
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => {
            send(text);
            setText('');
          }}
        />
        <IconButton
          icon="send"
          disabled={!connected || !text.trim()}
          onPress={() => {
            send(text);
            setText('');
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  list: { padding: 12 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 12, marginBottom: 8 },
  user: { alignSelf: 'flex-end', backgroundColor: '#f5a62333', borderWidth: 1, borderColor: '#f5a62355' },
  bot: { alignSelf: 'flex-start', backgroundColor: '#0e1117', borderWidth: 1, borderColor: '#1f2a3c' },
  time: { fontSize: 10, color: '#8892a4', marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1f2a3c' },
});
