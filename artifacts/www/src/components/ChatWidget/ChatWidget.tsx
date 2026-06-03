'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://app.sphereenglish.com/api/chat';
const SESSION_KEY = 'sphere_chat_session';
const MESSAGES_KEY = 'sphere_chat_messages';

type Message = { role: 'user' | 'assistant'; content: string; timestamp?: string };

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    'Merhaba! Ben Sphere Asistan. Kurumsal İngilizce, AI koçluğu veya platform hakkında her şeyi sorabilirsin. Nasıl yardımcı olabilirim?',
  timestamp: new Date().toISOString(),
};

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      'sphere_' +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // localStorage'dan eski mesajları yükle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(MESSAGES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {}
    }
  }, []);

  // Mesajları kaydet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (messages.length > 1) {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Açıldığında sonuca scroll
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          sessionId,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Asistan cevap veremiyor.');
      }

      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.capturedLead) {
        setLeadCaptured(true);
      }

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Üzgünüm, şu anda yanıt veremiyorum. Lütfen birazdan tekrar deneyin veya iletişim formunu kullanın: https://www.sphereenglish.com/iletisim',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    if (!confirm('Sohbet geçmişini silmek istediğinden emin misin?')) return;
    setMessages([INITIAL_MESSAGE]);
    setLeadCaptured(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MESSAGES_KEY);
    }
  }

  return (
    <>
      {/* Açma/kapama butonu */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Sohbeti kapat' : 'Sohbeti aç'}
        className="sphere-chat-toggle"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9998,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#082567',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(8, 37, 103, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(8, 37, 103, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(8, 37, 103, 0.3)';
        }}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        ) : (
          <>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {hasUnread && (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid white',
                }}
              />
            )}
          </>
        )}
      </button>

      {/* Sohbet penceresi */}
      {isOpen && (
        <div
          className="sphere-chat-panel"
          style={{
            position: 'fixed',
            bottom: 96,
            right: 24,
            zIndex: 9999,
            width: 380,
            maxWidth: 'calc(100vw - 48px)',
            height: 560,
            maxHeight: 'calc(100vh - 120px)',
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#082567',
              color: 'white',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Sphere Asistan</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    marginRight: 6,
                  }}
                />
                Çevrimiçi · Hemen yanıtlıyor
              </div>
            </div>
            <button
              onClick={clearChat}
              title="Sohbeti temizle"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Mesajlar */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              background: '#f8f9fb',
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: m.role === 'user' ? '#082567' : 'white',
                    color: m.role === 'user' ? 'white' : '#1f2937',
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: m.role === 'assistant' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', marginBottom: 12 }}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'white',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <span className="sphere-typing-dot" style={dotStyle} />
                  <span className="sphere-typing-dot" style={{ ...dotStyle, animationDelay: '0.2s' }} />
                  <span className="sphere-typing-dot" style={{ ...dotStyle, animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            {leadCaptured && (
              <div
                style={{
                  margin: '8px 0',
                  padding: '10px 14px',
                  background: '#dcfce7',
                  color: '#166534',
                  borderRadius: 12,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                ✓ Bilgilerin alındı. En kısa sürede dönüş yapacağız.
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              borderTop: '1px solid #e5e7eb',
              padding: 12,
              background: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Sorunu yaz..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 14,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.4,
                  maxHeight: 120,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#082567')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                aria-label="Gönder"
                style={{
                  background: input.trim() && !loading ? '#082567' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: '#9ca3af',
                textAlign: 'center',
              }}
            >
              Sphere Asistan AI ile çalışır · Önemli kararlar için insan danışmanımıza danışın
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sphere-blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .sphere-typing-dot {
          animation: sphere-blink 1.4s infinite both;
        }
        @media (max-width: 480px) {
          .sphere-chat-panel {
            width: calc(100vw - 32px) !important;
            right: 16px !important;
            bottom: 88px !important;
          }
          .sphere-chat-toggle {
            bottom: 16px !important;
            right: 16px !important;
          }
        }
      `}</style>
    </>
  );
}

const dotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#9ca3af',
  margin: '0 2px',
};
