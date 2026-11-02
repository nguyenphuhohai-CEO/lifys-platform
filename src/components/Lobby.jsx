import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';

const SITE_LABELS = { amical: 'Amis', amoureux: 'Love', 'sans-lendemain': 'Éphémère', mariage: 'Mariage', professionnel: 'Pro' };
const EMOTICONS = [[':)', '😊'], [':-)', '😊'], [':D', '😄'], [';)', '😉'], [':p', '😛'], [':P', '😛'], [':(', '😞'], [':o', '😮'], ['(L)', '❤️'], ['(y)', '👍'], ['(n)', '👎'], ['(h)', '😎'], ['(k)', '😘'], ['(*)', '⭐']];
const PICKER = ['😊', '😄', '😉', '😛', '😞', '😮', '❤️', '👍', '😎', '😘'];

function withEmoticons(text) {
  return EMOTICONS.reduce((out, [code, emoji]) => out.split(code).join(emoji), text);
}

export default function Lobby({ token, t, onError }) {
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [text, setText] = useState('');
  const [shake, setShake] = useState(false);
  const lastId = useRef(0);
  const logRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const data = await api.getLobby(token, lastId.current);
      setOnline(data.online);
      if (data.messages.length) {
        lastId.current = data.messages[data.messages.length - 1].id;
        setMessages((current) => [...current, ...data.messages].slice(-200));
        if (data.messages.some((message) => message.kind === 'nudge' && !message.mine)) {
          setShake(true);
          setTimeout(() => setShake(false), 800);
        }
      }
    } catch (error) {
      if (error?.status !== 429) onError(error, t('Impossible de charger le salon.'));
    }
  }, [token, onError, t]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = async (payload) => {
    try {
      await api.postLobby(token, payload);
      setText('');
      poll();
    } catch (error) {
      onError(error, t('Message non envoyé.'));
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (text.trim()) send({ body: text });
  };

  return (
    <section className={`content-panel msn${shake ? ' msn-shake' : ''}`}>
      <header className="panel-header">
        <p className="eyebrow">{t('Salon')}</p>
        <h2>{t('Salon Lifys')}</h2>
        <p className="muted">{t('Un chat commun à tous les sites, comme au temps de MSN. Restez courtois : soyez respectueux, 18 ans minimum.')}</p>
      </header>
      <div className="msn-window">
        <aside className="msn-contacts">
          <h3>{t('En ligne')} ({online.length})</h3>
          <ul>
            {online.map((person, index) => (
              <li key={index}><span className="msn-dot" />{person.me ? t('Vous') : person.name}<small> {t(SITE_LABELS[person.site] ?? person.site)}</small></li>
            ))}
          </ul>
        </aside>
        <div className="msn-chat">
          <div className="msn-log" ref={logRef} aria-live="polite">
            {messages.length === 0 ? <p className="muted">{t('Personne n’a encore écrit. Lancez la conversation !')}</p> : null}
            {messages.map((message) => (
              message.kind === 'nudge'
                ? <p key={message.id} className="msn-system">{message.mine ? t('Vous avez envoyé un wizz !') : t('{name} a envoyé un wizz !', { name: message.name })}</p>
                : <p key={message.id} className={message.mine ? 'msn-line msn-mine' : 'msn-line'}><strong>{message.name}</strong> <small>({t(SITE_LABELS[message.site] ?? message.site)})</small> : {withEmoticons(message.body)}</p>
            ))}
          </div>
          <div className="msn-emojis">
            {PICKER.map((emoji) => <button key={emoji} type="button" aria-label={emoji} onClick={() => setText((current) => current + emoji)}>{emoji}</button>)}
            <button type="button" className="msn-wizz" onClick={() => send({ kind: 'nudge' })}>📳 {t('Wizz')}</button>
          </div>
          <form className="msn-form" onSubmit={submit}>
            <input value={text} maxLength={300} onChange={(event) => setText(event.target.value)} placeholder={t('Écrire un message…')} aria-label={t('Message')} />
            <button type="submit" className="primary-button">{t('Envoyer')}</button>
          </form>
        </div>
      </div>
    </section>
  );
}
