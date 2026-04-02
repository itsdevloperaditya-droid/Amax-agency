(function () {
  const API_URL = window.location.hostname === 'localhost' ? '' : 'https://amax-sskg.onrender.com';
  let chatHistory = [];
  let isOpen = false;

  const styles = `
    #amax-chatbot-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(139, 92, 246, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.25);
      transition: all 0.3s ease;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    #amax-chatbot-toggle:hover {
      transform: scale(1.08);
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
      background: rgba(139, 92, 246, 0.95);
    }
    #amax-chatbot-toggle svg {
      width: 24px;
      height: 24px;
      fill: white;
      transition: all 0.3s ease;
    }
    #amax-chatbot-toggle.hidden {
      display: none;
    }

    #amax-chatbot-window {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 520px;
      max-height: calc(100vh - 48px);
      background: #0d0d16;
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: amaxSlideUp 0.3s ease;
    }
    #amax-chatbot-window.open {
      display: flex;
    }

    @keyframes amaxSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #amax-chatbot-header {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.1));
      padding: 16px 20px;
      border-bottom: 1px solid rgba(139, 92, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #amax-chatbot-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    #amax-chatbot-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #8B5CF6, #A855F7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    #amax-chatbot-title {
      color: white;
      font-weight: 600;
      font-size: 15px;
    }
    #amax-chatbot-status {
      color: #4ade80;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #amax-chatbot-status::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
    }
    #amax-chatbot-close {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 20px;
      padding: 4px;
      transition: color 0.2s;
    }
    #amax-chatbot-close:hover {
      color: white;
    }

    #amax-chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    #amax-chatbot-messages::-webkit-scrollbar {
      width: 4px;
    }
    #amax-chatbot-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    #amax-chatbot-messages::-webkit-scrollbar-thumb {
      background: rgba(139, 92, 246, 0.3);
      border-radius: 4px;
    }

    .amax-msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      animation: amaxMsgIn 0.3s ease;
    }
    @keyframes amaxMsgIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .amax-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #8B5CF6, #A855F7);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .amax-msg.bot {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.05);
      color: #e5e7eb;
      border: 1px solid rgba(139, 92, 246, 0.15);
      border-bottom-left-radius: 4px;
    }
    .amax-msg.bot a {
      color: #8B5CF6;
      text-decoration: none;
      font-weight: 500;
    }
    .amax-msg.bot a:hover {
      text-decoration: underline;
    }

    .amax-typing {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      align-self: flex-start;
    }
    .amax-typing span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #8B5CF6;
      animation: amaxTyping 1.4s infinite;
    }
    .amax-typing span:nth-child(2) { animation-delay: 0.2s; }
    .amax-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes amaxTyping {
      0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
      30% { opacity: 1; transform: scale(1); }
    }

    #amax-chatbot-input-area {
      padding: 12px 16px;
      border-top: 1px solid rgba(139, 92, 246, 0.2);
      display: flex;
      gap: 8px;
      background: rgba(15, 15, 25, 0.8);
    }
    #amax-chatbot-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 12px;
      padding: 10px 14px;
      color: white;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    #amax-chatbot-input:focus {
      border-color: #8B5CF6;
    }
    #amax-chatbot-input::placeholder {
      color: #6b7280;
    }
    #amax-chatbot-send {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #8B5CF6, #A855F7);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    #amax-chatbot-send:hover {
      transform: scale(1.05);
    }
    #amax-chatbot-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    #amax-chatbot-send svg {
      width: 18px;
      height: 18px;
      fill: white;
    }

    @media (max-width: 480px) {
      #amax-chatbot-window {
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        bottom: 0 !important;
        right: 0 !important;
        left: 0 !important;
        top: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }
      #amax-chatbot-toggle {
        bottom: 16px;
        right: 16px;
        width: 54px;
        height: 54px;
      }
      #amax-chatbot-messages {
        -webkit-overflow-scrolling: touch;
        padding: 12px;
      }
      #amax-chatbot-input-area {
        padding: 10px 12px;
        padding-bottom: max(10px, env(safe-area-inset-bottom));
        background: #0d0d16;
      }
      #amax-chatbot-input {
        font-size: 16px;
      }
      .amax-msg {
        max-width: 90%;
      }
    }
  `;

  function injectStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Ensure proper viewport meta for mobile
    let metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      if (!metaViewport.content.includes('interactive-widget')) {
        metaViewport.content = metaViewport.content.replace('viewport-fit=cover', 'viewport-fit=cover, interactive-widget=resizes-content');
        if (!metaViewport.content.includes('viewport-fit')) {
          metaViewport.content += ', interactive-widget=resizes-content';
        }
      }
    }
  }

  function createWidget() {
    injectStyles();

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'amax-chatbot-toggle';
    toggleBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    document.body.appendChild(toggleBtn);

    // Chat window
    const chatWindow = document.createElement('div');
    chatWindow.id = 'amax-chatbot-window';
    chatWindow.innerHTML = `
      <div id="amax-chatbot-header">
        <div id="amax-chatbot-header-left">
          <div id="amax-chatbot-avatar"><img src="amax-logo.jpeg" alt="Amax" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>
          <div>
            <div id="amax-chatbot-title">Amax AI</div>
            <div id="amax-chatbot-status">Online</div>
          </div>
        </div>
        <button id="amax-chatbot-close">&times;</button>
      </div>
      <div id="amax-chatbot-messages"></div>
      <div id="amax-chatbot-input-area">
        <input type="text" id="amax-chatbot-input" placeholder="Ask me anything..." autocomplete="off">
        <button id="amax-chatbot-send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(chatWindow);

    // Event listeners
    toggleBtn.addEventListener('click', toggleChat);
    document.getElementById('amax-chatbot-close').addEventListener('click', toggleChat);
    document.getElementById('amax-chatbot-send').addEventListener('click', sendMessage);
    document.getElementById('amax-chatbot-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Prevent keyboard shift issues on mobile
    const inputEl = document.getElementById('amax-chatbot-input');
    inputEl.addEventListener('focus', () => {
      setTimeout(() => {
        const messagesEl = document.getElementById('amax-chatbot-messages');
        if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 300);
    });

    // Handle visual viewport changes (keyboard open/close)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const chatWindow = document.getElementById('amax-chatbot-window');
        if (chatWindow && chatWindow.classList.contains('open')) {
          chatWindow.style.height = window.visualViewport.height + 'px';
          chatWindow.style.bottom = (window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop) + 'px';
          const messagesEl = document.getElementById('amax-chatbot-messages');
          if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      });
    }

  }

  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('amax-chatbot-window');
    const toggleBtn = document.getElementById('amax-chatbot-toggle');
    const messagesEl = document.getElementById('amax-chatbot-messages');

    if (isOpen) {
      chatWindow.classList.add('open');
      toggleBtn.classList.add('hidden');
      if (window.innerWidth > 480) {
        document.getElementById('amax-chatbot-input').focus();
      }
      if (chatHistory.length === 0) {
        setTimeout(() => {
          addMessage("Hey! 👋 Welcome to Amax! Main aapki madad kar sakta hoon:\n\n🎬 Video Editing\n🎨 Thumbnail Design\n💻 Web Development\n🖌️ Graphic Design\n💰 Join as Freelancer\n\nBataiye, kya chahiye? 🚀 [Get Started](https://wa.me/919509136278)", false, false);
        }, 300);
      }
    } else {
      chatWindow.classList.remove('open');
      toggleBtn.classList.remove('hidden');
      chatHistory = [];
      if (messagesEl) messagesEl.innerHTML = '';
    }
  }

  function addMessage(text, isUser, save = true) {
    const messagesEl = document.getElementById('amax-chatbot-messages');
    const msgEl = document.createElement('div');
    msgEl.className = `amax-msg ${isUser ? 'user' : 'bot'}`;

    // Convert markdown links to HTML
    const formattedText = text
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');

    msgEl.innerHTML = formattedText;
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (save) {
      chatHistory.push({ text, isUser });
    }
  }

  function showTyping() {
    const messagesEl = document.getElementById('amax-chatbot-messages');
    const typingEl = document.createElement('div');
    typingEl.className = 'amax-typing';
    typingEl.id = 'amax-typing-indicator';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const typingEl = document.getElementById('amax-typing-indicator');
    if (typingEl) typingEl.remove();
  }

  async function sendMessage() {
    const input = document.getElementById('amax-chatbot-input');
    const sendBtn = document.getElementById('amax-chatbot-send');
    const message = input.value.trim();

    if (!message) return;

    addMessage(message, true);
    input.value = '';
    sendBtn.disabled = true;
    showTyping();

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chatHistory })
      });

      const data = await response.json();
      hideTyping();
      addMessage(data.response || data.error || "Sorry, something went wrong. Try again!", false);
    } catch (err) {
      hideTyping();
      addMessage("Sorry, I'm having trouble connecting. Please try again or contact us on [WhatsApp](https://wa.me/919509136278) 🚀", false);
    } finally {
      sendBtn.disabled = false;
      if (window.innerWidth > 480) {
        input.focus();
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
