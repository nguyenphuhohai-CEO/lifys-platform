import AvatarImage from './AvatarImage';
import { MODES } from '../constants';

function MessagesView({
  messages,
  selectedConversation,
  setSelectedConversation,
  selectedConversationData,
  draftMessage,
  setDraftMessage,
  onSendMessage,
}) {
  return (
    <section className="messages-layout content-panel">
      <aside className="conversation-list" aria-label="Conversations">
        {messages.length === 0 ? (
          <div className="empty-state compact">
            <h3>Aucune conversation active</h3>
            <p>Un match démarrera automatiquement une conversation locale.</p>
          </div>
        ) : (
          messages.map((conversation) => (
            <button
              key={conversation.id}
              className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
              onClick={() => setSelectedConversation(conversation.id)}
              type="button"
            >
              <AvatarImage src={conversation.avatar} alt={`Photo de ${conversation.name}`} />
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
              <AvatarImage src={selectedConversationData.avatar} alt={`Photo de ${selectedConversationData.name}`} />
              <div>
                <strong>{selectedConversationData.name}</strong>
                <small>{MODES.find((mode) => mode.id === selectedConversationData.mode)?.label}</small>
              </div>
            </div>

            <div className="chat-body">
              {selectedConversationData.messages.map((message) => (
                <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                  {message.text}
                </div>
              ))}
            </div>

            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                onSendMessage();
              }}
            >
              <label className="sr-only" htmlFor="message-input">
                Message
              </label>
              <input
                id="message-input"
                type="text"
                placeholder="Écrire un message..."
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
              />
              <button className="primary-button" type="submit">
                Envoyer
              </button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <h3>Aucune conversation</h3>
            <p>Sélectionnez un match pour commencer une conversation locale.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default MessagesView;
