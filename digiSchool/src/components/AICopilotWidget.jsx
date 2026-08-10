import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, X, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function AICopilotWidget({ store, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: `Hello ${user?.full_name?.split(' ')[0] || ''}! I'm the EduOne AI Copilot. I'm connected to your school's database. How can I help you today?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      // We give the AI a system prompt injected with live context from the 'store'
      const systemPrompt = `You are the EduOne AI Copilot, a helpful AI assistant for a Kenyan secondary school. 
The user is logged in as: ${user?.role}.
The school currently has:
- ${store.students?.length || 0} students enrolled.
- ${store.teachers?.length || 0} teachers.
Be concise, friendly, and helpful. Format your replies in plain text or simple markdown.`;

      // Build the message history
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({
          role: m.sender === 'ai' ? 'assistant' : 'user',
          content: m.text
        })),
        { role: 'user', content: userMsg.text }
      ];

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.detail || json.error || 'Failed to fetch AI response');
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: json.text }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: `Sorry, I ran into an error: ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#047857',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(4, 120, 87, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 380,
          height: 600,
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: 'white',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          overflow: 'hidden',
          border: '1px solid var(--border)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#047857', padding: 8, borderRadius: '10px', color: 'white' }}><Bot size={20} /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>EduOne Copilot</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Powered by AI</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, background: '#ffffff' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                {msg.sender === 'ai' && <div style={{ background: '#eef2ff', color: '#047857', padding: 8, borderRadius: '10px', flexShrink: 0 }}><Bot size={16} /></div>}
                <div style={{ 
                  background: msg.sender === 'user' ? '#047857' : '#f8fafc', 
                  color: msg.sender === 'user' ? 'white' : '#374151',
                  padding: '12px 16px', 
                  border: msg.sender === 'user' ? 'none' : '1px solid #e5e7eb',
                  borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </div>
                {msg.sender === 'user' && <div style={{ background: '#f3f4f6', color: '#4b5563', padding: 8, borderRadius: '10px', flexShrink: 0 }}><User size={16} /></div>}
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: '85%' }}>
                <div style={{ background: '#eef2ff', color: '#047857', padding: 8, borderRadius: '10px', flexShrink: 0 }}><Bot size={16} /></div>
                <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'white' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 24, padding: '4px 4px 4px 16px' }}>
              <input 
                type="text" 
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#111827' }}
                placeholder="Ask a question..." 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={isTyping}
              />
              <button 
                style={{ background: input.trim() ? '#047857' : '#cbd5e1', color: 'white', borderRadius: 20, width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: (isTyping || !input.trim()) ? 'not-allowed' : 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
                onClick={handleSend}
                disabled={isTyping || !input.trim()}
              >
                <Send size={16} style={{ marginLeft: -2 }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
