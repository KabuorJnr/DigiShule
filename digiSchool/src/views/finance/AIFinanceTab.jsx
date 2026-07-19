import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bot, Send, User } from 'lucide-react';

export default function AIFinanceTab() {
  const { user } = useOutletContext();
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: 'Hello! I am your AI Finance Assistant. You can ask me about outstanding balances, budget limits, spending trends, or policy guidelines. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Mock AI response
    setTimeout(() => {
      let aiText = "I'm sorry, I couldn't find specific data for that query in the current database.";
      const lower = userMsg.text.toLowerCase();
      
      if (lower.includes('budget') || lower.includes('limit')) {
        aiText = "Based on the current term's budget, you have utilized 85% of the 'Co-curricular Activities' budget. I recommend deferring non-essential sports purchases until next term.";
      } else if (lower.includes('defaulter') || lower.includes('outstanding') || lower.includes('owe')) {
        aiText = "There are currently 45 students with balances older than 30 days, totaling KES 1.2M. Form 3 has the highest outstanding balance. Would you like me to draft an SMS reminder?";
      } else if (lower.includes('payroll') || lower.includes('salary')) {
        aiText = "The payroll for July 2026 is currently pending approval. The total gross pay is KES 1,250,000 across 45 staff members.";
      } else if (lower.includes('expense') || lower.includes('spend')) {
        aiText = "Total approved expenses for this month are KES 350,000. This is 12% lower than the same period last month.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiText }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <div className="card card-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ background: '#3B82F6', padding: 10, borderRadius: '50%', color: 'white' }}><Bot size={24} /></div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>EduOne Finance Copilot</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ask questions in natural language</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {msg.sender === 'ai' && <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: 8, borderRadius: '50%' }}><Bot size={16} /></div>}
              <div style={{ 
                background: msg.sender === 'user' ? '#10B981' : '#F3F4F6', 
                color: msg.sender === 'user' ? 'white' : 'inherit',
                padding: '12px 16px', 
                borderRadius: msg.sender === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                fontSize: 14,
                lineHeight: 1.5
              }}>
                {msg.text}
              </div>
              {msg.sender === 'user' && <div style={{ background: '#E5E7EB', color: '#4B5563', padding: 8, borderRadius: '50%' }}><User size={16} /></div>}
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', maxWidth: '80%' }}>
              <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: 8, borderRadius: '50%' }}><Bot size={16} /></div>
              <div style={{ background: '#F3F4F6', padding: '12px 16px', borderRadius: '16px 16px 16px 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                Copilot is thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <input 
            type="text" 
            className="input" 
            style={{ flex: 1, borderRadius: 24, paddingLeft: 20 }}
            placeholder="Ask a question about the school's finances..." 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isTyping}
          />
          <button 
            className="btn btn-primary" 
            style={{ borderRadius: '50%', width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
