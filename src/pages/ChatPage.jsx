import StaffChat from '../components/StaffChat';
import { CHAT_WS_URL } from '../config';

export default function ChatPage() {
  return (
    <div className="chat-page-container">
      <style>{`
        .chat-page-container {
          height: calc(100vh - 140px); /* Adjust for header and padding */
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .chat-header {
          margin-bottom: 8px;
        }

        .chat-title {
          font-size: 24px;
          font-weight: 700;
          color: #e8eaf0;
          margin-bottom: 4px;
        }

        .chat-subtitle {
          font-size: 13px;
          color: #8892a4;
        }

        .chat-interface-wrapper {
          flex: 1;
          min-height: 0; /* Important for flex child to be scrollable */
          background: #0e1117;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        @media (max-width: 768px) {
          .chat-page-container {
            height: calc(100vh - 120px);
          }
        }
      `}</style>

      <div className="chat-header">
        <h1 className="chat-title">AI Command Center</h1>
        <p className="chat-subtitle">Direct line to the HotelOS multi-agent orchestrator</p>
      </div>

      <div className="chat-interface-wrapper">
        <StaffChat wsUrl={CHAT_WS_URL} />
      </div>
    </div>
  );
}