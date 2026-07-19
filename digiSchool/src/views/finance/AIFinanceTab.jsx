import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bot, Send, User } from 'lucide-react';
import { fmtKES } from '../../data/modules';

export default function AIFinanceTab() {
  const { invoices = [], payments = [], expenses = [], students = [] } = useOutletContext() || {};
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: 'Hello! I am your AI Finance Assistant. I am directly connected to your local school database. You can ask me about outstanding balances, total revenue, pending expenses, or student statistics.' }
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

    // Compute real answers based on local state (Local Data Engine)
    setTimeout(() => {
      let aiText = "I'm sorry, I couldn't understand that query. Try asking about 'defaulters', 'total revenue', 'expenses', or 'students'.";
      const lower = userMsg.text.toLowerCase();
      
      if (lower.includes('defaulter') || lower.includes('unpaid') || lower.includes('owe') || lower.includes('balance') || lower.includes('outstanding')) {
        const unpaidInvoices = invoices.filter(i => i.status !== 'Paid');
        const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + (Number(i.amount || 0) - Number(i.paid || 0)), 0);
        aiText = `There are currently ${unpaidInvoices.length} unpaid or partially paid invoices in the system, with a total outstanding balance of ${fmtKES(totalUnpaid)}. You can view the full breakdown in the Defaulters list.`;
      } 
      else if (lower.includes('revenue') || lower.includes('paid') || lower.includes('payment') || lower.includes('collect')) {
        const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        aiText = `We have collected a total of ${fmtKES(totalPayments)} in registered payments so far across all records.`;
      } 
      else if (lower.includes('expense') || lower.includes('spend') || lower.includes('cost')) {
        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const pendingExpenses = expenses.filter(e => e.status === 'Pending').length;
        aiText = `The total recorded expenses amount to ${fmtKES(totalExpenses)}. There are currently ${pendingExpenses} pending expense requests awaiting approval.`;
      } 
      else if (lower.includes('student') || lower.includes('population') || lower.includes('enroll')) {
        aiText = `There are currently ${students.length} students enrolled and registered in the system database.`;
      }
      else if (lower.includes('budget') || lower.includes('limit')) {
        aiText = "Budget tracking is currently linked directly to your departmental expenses. Please ensure all procurement requests are updated in the Expenses tab to monitor utilization.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiText }]);
      setIsTyping(false);
    }, 800); // Shorter delay for local computation
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div className="card card-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)', padding: '20px 24px', background: '#f8fafc' }}>
          <div style={{ background: '#6366f1', padding: 10, borderRadius: '12px', color: 'white', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}><Bot size={24} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>EduOne Finance Copilot</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Real-time insights from your school's local database</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {msg.sender === 'ai' && <div style={{ background: '#eef2ff', color: '#6366f1', padding: 10, borderRadius: '12px' }}><Bot size={18} /></div>}
              <div style={{ 
                background: msg.sender === 'user' ? '#6366f1' : '#f8fafc', 
                color: msg.sender === 'user' ? 'white' : '#374151',
                padding: '14px 18px', 
                border: msg.sender === 'user' ? 'none' : '1px solid #e5e7eb',
                borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: 14,
                lineHeight: 1.6,
                boxShadow: msg.sender === 'user' ? '0 4px 12px rgba(99,102,241,0.2)' : '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                {msg.text}
              </div>
              {msg.sender === 'user' && <div style={{ background: '#f3f4f6', color: '#4b5563', padding: 10, borderRadius: '12px' }}><User size={18} /></div>}
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', maxWidth: '85%' }}>
              <div style={{ background: '#eef2ff', color: '#6366f1', padding: 10, borderRadius: '12px' }}><Bot size={18} /></div>
              <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: '14px 18px', borderRadius: '16px 16px 16px 4px', color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>
                Analyzing data...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'white' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 24, padding: '4px 4px 4px 20px', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            <input 
              type="text" 
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: '#111827' }}
              placeholder="Ask about outstanding balances, total expenses, or revenue..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={isTyping}
            />
            <button 
              className="btn" 
              style={{ background: input.trim() ? '#6366f1' : '#cbd5e1', color: 'white', borderRadius: 20, width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', transition: 'background 0.2s' }}
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
            >
              <Send size={18} style={{ marginLeft: -2 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
