import Avatar from './Avatar';
import { getConversationPreview, getModeLabel } from '../lib/app-utils';

export default function MessagesView({
  conversations,
  draftMessage,
  onChangeDraft,
  onSend,
  onSelectConversation,
  selectedConversationId,
  selectedConversation,
}) {
  return (
    <section className="messages-layout content-panel">
      <aside className="conversation-list">
        <div className="panel-header compact-header">
          <div>
            <p className="eyebrow">Messagerie</p>
            <h2>Conversations</h2>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>Aucune conversation</h3>
            <p>Les messages apparaîtront ici après vos premiers matchs locaux.</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={selectedConversationId === conversation.id ? 'conversation-item active' : 'conversation-item'}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <Avatar src={conversation.avatar} name={conversation.name} className="conversation-avatar" />
              <div>
                <strong>{conversation.name}</strong>
                <small>{getConversationPreview(conversation)}</small>
              </div>
            </button>
          ))
        )}
      </aside>

      <div className="chat-panel">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <Avatar src={selectedConversation.avatar} name={selectedConversation.name} className="chat-avatar" />
              <div>
                <strong>{selectedConversation.name}</strong>
                <small>{selectedConversation.city} · {getModeLabel(selectedConversation.mode)}</small>
              </div>
            </div>

            <div className="chat-body">
              {selectedConversation.messages.map((message) => (
                <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                  {message.text}
                </div>
              ))}
            </div>

            <div className="composer">
              <input
                type="text"
                placeholder="Écrire un message et appuyer sur Entrée"
                value={draftMessage}
                onChange={(event) => onChangeDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSend();
                  }
                }}
              />
              <button type="button" className="primary-button" onClick={onSend}>Envoyer</button>
            </div>
          </>
        ) : (
          <div className="empty-state centered-fill">
            <h3>Sélectionnez une conversation</h3>
            <p>Chaque échange de cette interface est local et simulé pour la démo.</p>
          </div>
        )}
      </div>
    </section>
  );
}
