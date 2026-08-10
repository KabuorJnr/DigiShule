import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bot, Send, User } from 'lucide-react';
import { fmtKES } from '../../data/modules';

export default function AIFinanceTab() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#4b5563' }}>
      <h2 style={{ marginBottom: 16 }}>AI Assistant Upgraded!</h2>
      <p style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>
        The EduOne Copilot has been upgraded to a true AI and is now a global service! 
        You can access it from <strong>any portal</strong> by clicking the chat icon in the bottom right corner of your screen.
      </p>
    </div>
  );
}



