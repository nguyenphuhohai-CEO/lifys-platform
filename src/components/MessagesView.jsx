import { useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { getModeMeta } from '../lib/appUtils';

export default function MessagesView({
  messages,
  selectedConversation,
  selectedConversationData,
  draftMessage,
  onConversationChange,
  onDraftChange,
  onSendMessage,
}) {
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [selectedConversationData]);

  return (
    <section className="messages-layout content-panel">
      <aside className="conversation-list" aria-label="Conversations">
        {messages.length === 0 ? (
          <div className="empty-state compact">
            <h3>Aucune conversation</h3>
            <p>Vos futurs matchs apparaîtront ici.</p>
          </div>
        ) : (
          messages.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
              onClick={() => onConversationChange(conversation.id)}
            >
              <Avatar src={conversation.avatar} alt={`Photo de ${conversation.name}`} name={conversation.name} className="conversation-avatar" />
              <div>
                <strong>{conversation.name}</strong>
                <small>{conversation.messages[conversation.messages.length - 1]?.text || 'Aucun message'}</small>
              </div>
            </button>
          ))
        )}
      </aside>

      <div className="chat-panel">
        {selectedConversationData ? (
          <>
            <div className="chat-header">
              <Avatar src={selectedConversationData.avatar} alt={`Photo de ${selectedConversationData.name}`} name={selectedConversationData.name} className="chat-avatar" />
              <div>
                <strong>{selectedConversationData.name}</strong>
                <small>{getModeMeta(selectedConversationData.mode).label} · {selectedConversationData.status}</small>
              </div>
            </div>

            <div className="chat-body" ref={chatBodyRef}>
              {selectedConversationData.messages.map((message) => (
                <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                  {message.text}
                </div>
              ))}
            </div>

            <div className="composer">
              <label className="sr-only" htmlFor="message-input">Écrire un message</label>
              <input
                id="message-input"
                type="text"
                placeholder="Écrire un message..."
                value={draftMessage}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSendMessage();
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={onSendMessage}>Envoyer</button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>Sélectionnez une conversation</h3>
            <p>Choisissez un match à gauche pour poursuivre l’échange.</p>
          </div>
        )}
      </div>
    </section>
  );
}
