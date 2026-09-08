import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, API_BASE_URL } from '../lib/api';

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO';
  createdAt: string;
}

export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    api.get(`/messages/${conversationId}`).then((res) => setMessages(res.data));

    const token = localStorage.getItem('lifys_access_token');
    const socket = io(API_BASE_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('join-conversation', { conversationId });
    socket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
    };
  }, [conversationId]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !conversationId) return;

    socketRef.current?.emit('send-message', { conversationId, content });
    setContent('');
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-purple-700">Messages</h1>
      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 p-4">
        {messages.map((message) => (
          <p key={message.id} className="mb-2 text-sm">
            {message.content}
          </p>
        ))}
      </div>
      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écrivez un message..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
        />
        <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">
          Envoyer
        </button>
      </form>
    </div>
  );
}
