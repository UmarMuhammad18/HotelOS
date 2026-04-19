import StaffChat from '../components/StaffChat';
import { CHAT_WS_URL } from '../config';

export default function ChatPage() {
  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <h1>Staff AI Assistant</h1>
      <p>Testing chat component...</p>
      <div style={{ height: '500px', border: '1px solid red' }}>
        <StaffChat wsUrl={CHAT_WS_URL} />
      </div>
    </div>
  );
}