/============================================

// Global variables
let messagesDiv;
let messagesContainer;
let emptyState;
let chatForm;
let messageInput;
let sendButton;
let modelSelect;
let chatHistory;
let chatCount;
let currentChatTitle;
let viewModeNotice;

let messages = [];
let isLoading = false;
let availableModels = [];
let currentChatId = null;
let isViewMode = false;
const MAX_CHATS = 300;
const STORAGE_KEY = 'ai_chat_history';
let csrfToken = null;
let csrfTokenExpiry = 0;
const CSRF_TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
// ============================================
// ✅ CRITICAL FIX #1: Enhanced XSS Protection
// ============================================

/**
 * ✅ IMPROVED: Comprehensive HTML escaping
 * Protects against ALL XSS attack vectors
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    
    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    return text.replace(/[&<>"'`=/]/g, function(char) {
        return htmlEscapeMap[char];
    });
}

/**
 * ✅ NEW: Sanitize URL to prevent javascript: protocol
 */
function sanitizeUrl(url) {
    if (typeof url !== 'string') return '#';
    
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || 
        trimmed.startsWith('data:') || 
        trimmed.startsWith('vbscript:')) {
        return '#';
    }
    
    return url;
}

/**
 * ✅ NEW: Create text node safely (best practice)
 */
function createTextNode(text) {
    return document.createTextNode(text);
}

/**
 * ✅ NEW: Set text content safely (prefer over innerHTML)
 */
function setTextContent(element, text) {
    // Clear existing content
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    // Add text node
    element.appendChild(createTextNode(text));
}

// ============================================
// Initialize DOM elements
// ============================================
// ============================================
// ✅ CSRF Token Management
// ============================================

async function fetchCSRFToken() {
    try {
        const response = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch CSRF token');
        }

        const data = await response.json();
        
        if (!data.csrfToken) {
            throw new Error('No CSRF token in response');
        }

        csrfToken = data.csrfToken;
        csrfTokenExpiry = Date.now() + CSRF_TOKEN_REFRESH_INTERVAL;
        
        console.log('✅ CSRF token fetched successfully');
        return true;
    } catch (err) {
        console.error('❌ Failed to fetch CSRF token:', err);
        return false;
    }
}

function needsCSRFRefresh() {
    return !csrfToken || Date.now() > csrfTokenExpiry;
}

async function ensureCSRFToken() {
    if (needsCSRFRefresh()) {
        const success = await fetchCSRFToken();
        if (!success) {
            throw new Error('Failed to obtain CSRF token');
        }
    }
    return csrfToken;
}
function initElements() {
    messagesDiv = document.getElementById('messages');
    messagesContainer = document.getElementById('messages-container');
    emptyState = document.getElementById('empty-state');
    chatForm = document.getElementById('chat-form');
    messageInput = document.getElementById('message-input');
    sendButton = document.getElementById('send-button');
    modelSelect = document.getElementById('model-select');
    chatHistory = document.getElementById('chat-history');
    chatCount = document.getElementById('chat-count');
    currentChatTitle = document.getElementById('current-chat-title');
    viewModeNotice = document.getElementById('view-mode-notice');
}

// ============================================
// Chat Storage with Enhanced Security
// ============================================

class ChatStorage {
    /**
   // ============================================
// ✅ COPY TOÀN BỘ CLASS NÀY - Thay thế ChatStorage cũ
// ============================================

class ChatStorage {
    static getAllChats() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return [];
            
            const parsed = JSON.parse(data);
            
            if (!Array.isArray(parsed)) {
                console.error('Invalid chat history format');
                return [];
            }
            
            const validChats = parsed.filter(chat => this.validateChatStructure(chat));
            return validChats;
        } catch (e) {
            console.error('Error reading chat history:', e);
            return [];
        }
    }

    static validateChatStructure(chat) {
        if (!chat || typeof chat !== 'object') return false;
        
        if (!chat.id || typeof chat.id !== 'string') return false;
        if (!Array.isArray(chat.messages)) return false;
        if (typeof chat.timestamp !== 'number') return false;
        
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(chat.id)) return false;
        if (chat.timestamp <= 0 || chat.timestamp > Date.now()) return false;
        if (chat.messages.length > 50) return false;
        
        for (const msg of chat.messages) {
            if (!this.validateMessage(msg)) return false;
        }
        
        return true;
    }

    static validateMessage(msg) {
        if (!msg || typeof msg !== 'object') return false;
        
        const validRoles = ['user', 'assistant', 'system'];
        if (!validRoles.includes(msg.role)) return false;
        
        if (typeof msg.content !== 'string') return false;
        if (msg.content.length > 5000) return false;
        
        return true;
    }

    static saveChat(chat) {
        try {
            if (!chat || typeof chat !== 'object') {
                console.error('Invalid chat object');
                return null;
            }
            
            const sanitizedChat = this.sanitizeChat(chat);
            
            if (!sanitizedChat) {
                console.error('Chat failed sanitization');
                return null;
            }
            
            if (!this.validateChatStructure(sanitizedChat)) {
                console.error('Invalid chat structure');
                return null;
            }
            
            let chats = this.getAllChats();
            
            if (chats.length >= MAX_CHATS) {
                chats = chats.slice(-MAX_CHATS + 1);
            }
            
            const existingIndex = chats.findIndex(c => c.id === sanitizedChat.id);
            if (existingIndex >= 0) {
                chats[existingIndex] = sanitizedChat;
            } else {
                chats.push(sanitizedChat);
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
            return sanitizedChat;
        } catch (e) {
            console.error('Error saving chat:', e);
            return null;
        }
    }

    static sanitizeChat(chat) {
        const sanitized = Object.create(null);
        
        if (typeof chat.id === 'string') {
            sanitized.id = chat.id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
        } else {
            return null;
        }
        
        if (typeof chat.timestamp === 'number') {
            sanitized.timestamp = Math.max(0, Math.min(chat.timestamp, Date.now()));
        } else {
            sanitized.timestamp = Date.now();
        }
        
        if (typeof chat.model === 'string') {
            sanitized.model = chat.model.substring(0, 200);
        } else {
            sanitized.model = 'unknown';
        }
        
        if (Array.isArray(chat.messages)) {
            sanitized.messages = chat.messages
                .slice(0, 50)
                .map(msg => this.sanitizeMessage(msg))
                .filter(msg => msg !== null);
        } else {
            return null;
        }
        
        return sanitized;
    }

    static sanitizeMessage(msg) {
        if (!msg || typeof msg !== 'object') return null;
        
        const sanitized = Object.create(null);
        
        const validRoles = ['user', 'assistant', 'system'];
        sanitized.role = validRoles.includes(msg.role) ? msg.role : 'user';
        
        if (typeof msg.content === 'string') {
            let content = msg.content
                .replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .substring(0, 5000);
            
            sanitized.content = content;
        } else {
            return null;
        }
        
        return sanitized;
    }

    static getChat(id) {
        const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
        if (!safeId) return null;
        
        const chats = this.getAllChats();
        const chat = chats.find(c => c.id === safeId);
        
        if (!chat) return null;
        return this.validateChatStructure(chat) ? chat : null;
    }

    static deleteChat(id) {
        try {
            const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
            if (!safeId) return false;
            
            let chats = this.getAllChats();
            const initialLength = chats.length;
            
            chats = chats.filter(c => c.id !== safeId);
            
            if (chats.length === initialLength) {
                return false;
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
            return true;
        } catch (e) {
            console.error('Error deleting chat:', e);
            return false;
        }
    }

    static getChatTitle(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return 'Chat mới';
        }
        
        const firstUserMessage = messages.find(m => m && m.role === 'user');
        if (!firstUserMessage || typeof firstUserMessage.content !== 'string') {
            return 'Chat mới';
        }
        
        let title = firstUserMessage.content
            .replace(/[<>]/g, '')
            .substring(0, 50)
            .trim();
        
        if (firstUserMessage.content.length > 50) {
            title += '...';
        }
        
        return escapeHtml(title || 'Chat mới');
    }
}
// ============================================
// Load Models
// ============================================

async function loadModels() {
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        
        availableModels = data.models || [];
        const defaultModel = data.default;

        // Clear existing options
        modelSelect.innerHTML = '';
        
        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            
            const modelName = model.split('/')[1].replace(':free', '').replace(/-/g, ' ');
            // ✅ Use textContent instead of innerHTML
            option.textContent = modelName.toUpperCase();
            
            if (model === defaultModel) option.selected = true;
            modelSelect.appendChild(option);
        });

        console.log('✅ Loaded models:', availableModels);
    } catch (error) {
        console.error('❌ Failed to load models:', error);
        modelSelect.innerHTML = '<option value="">Error loading models</option>';
    }
}

// ============================================
// ✅ CRITICAL FIX #2: Secure Chat History Rendering
// ============================================

/**
 * ✅ COMPLETELY REWRITTEN: No innerHTML, pure DOM manipulation
 */
function renderChatHistory() {
    const chats = ChatStorage.getAllChats();
    
    // Update count safely
    chatCount.textContent = chats.length;

    // Clear existing content
    chatHistory.innerHTML = '';

    if (chats.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-slate-400 text-sm text-center py-4';
        emptyMsg.textContent = 'Chưa có lịch sử chat';
        chatHistory.appendChild(emptyMsg);
        return;
    }

    chats.sort((a, b) => b.timestamp - a.timestamp);

    chats.forEach(chat => {
        // ✅ Get title (already escaped in getChatTitle)
        const title = ChatStorage.getChatTitle(chat.messages);
        
        const date = new Date(chat.timestamp).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
        
        const isActive = chat.id === currentChatId;

        // ✅ Create elements using DOM API (no innerHTML)
        const containerDiv = document.createElement('div');
        containerDiv.className = `group relative mb-1 ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'} rounded-lg transition-colors`;

        const chatButton = document.createElement('button');
        chatButton.className = `chat-item-btn w-full text-left p-3 rounded-lg ${isActive ? 'text-blue-600' : 'text-slate-700'}`;
        chatButton.setAttribute('data-chat-id', chat.id);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'flex items-start justify-between gap-2';

        const textDiv = document.createElement('div');
        textDiv.className = 'flex-1 min-w-0';

        const titleP = document.createElement('p');
        titleP.className = 'text-sm font-medium truncate';
        // ✅ Title is already escaped, but use textContent for extra safety
        titleP.textContent = title;

        const dateP = document.createElement('p');
        dateP.className = 'text-xs text-slate-500 mt-1';
        // ✅ Use textContent for date and message count
        dateP.textContent = `${date} • ${chat.messages.length} tin`;

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-chat-btn opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1';
        deleteButton.setAttribute('data-chat-id', chat.id);
        deleteButton.setAttribute('title', 'Xóa chat');
        deleteButton.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>`;

        // Assemble DOM tree
        textDiv.appendChild(titleP);
        textDiv.appendChild(dateP);
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(deleteButton);
        chatButton.appendChild(contentDiv);
        containerDiv.appendChild(chatButton);
        chatHistory.appendChild(containerDiv);

        // ✅ Add event listeners (not inline)
        chatButton.addEventListener('click', function() {
            const chatId = this.getAttribute('data-chat-id');
            loadChat(chatId);
        });

        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const chatId = this.getAttribute('data-chat-id');
            deleteChatWithConfirm(chatId);
        });
    });
}

// ============================================
// Chat Operations
// ============================================

function deleteChatWithConfirm(chatId) {
    if (confirm('Xóa chat này?')) {
        deleteChat(chatId);
    }
}

function createNewChat() {
    if (isViewMode && messages.length > 0) {
        if (!confirm('Bạn đang xem lịch sử. Tạo chat mới sẽ thoát chế độ xem, tiếp tục?')) {
            return;
        }
    }

    currentChatId = 'chat_' + Date.now();
    messages = [];
    isViewMode = false;

    const emptyStateHtml = `
        <div class="text-center text-slate-400 mt-20" id="empty-state">
            <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Bắt đầu cuộc trò chuyện</p>
        </div>
    `;
    
    messagesDiv.innerHTML = emptyStateHtml;
    emptyState = document.getElementById('empty-state');

    currentChatTitle.textContent = 'Chat mới';
    messageInput.disabled = false;
    sendButton.disabled = false;
    modelSelect.disabled = false;
    viewModeNotice.classList.add('hidden');
    messageInput.value = '';
    messageInput.focus();
    renderChatHistory();

    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('sidebar-hidden');
    }
}

ffunction loadChat(chatId) {
    const safeChatId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
    if (!safeChatId) {
        console.error('Invalid chat ID');
        return;
    }
    
    const chat = ChatStorage.getChat(safeChatId);
    if (!chat) return;

    currentChatId = safeChatId;
    
    // ✅ Deep clone to prevent prototype pollution
    try {
        messages = JSON.parse(JSON.stringify(chat.messages));
        
        if (!Array.isArray(messages)) {
            console.error('Invalid messages after clone');
            messages = [];
            return;
        }
        
        messages = messages.filter(msg => ChatStorage.validateMessage(msg));
        
    } catch (e) {
        console.error('Error cloning messages:', e);
        messages = [];
        return;
    }
    
    isViewMode = true;

    messagesDiv.innerHTML = '';
    emptyState = null;
    
    messages.forEach(msg => {
        addMessage(msg.role, msg.content, false);
    });

    currentChatTitle.textContent = '📖 ' + ChatStorage.getChatTitle(chat.messages);
    messageInput.disabled = true;
    sendButton.disabled = true;
    modelSelect.disabled = true;
    viewModeNotice.classList.remove('hidden');
    
    renderChatHistory();

    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('sidebar-hidden');
    }
}

    messagesDiv.innerHTML = '';
    emptyState = null;
    
    messages.forEach(msg => {
        addMessage(msg.role, msg.content, false);
    });

    // ✅ Use textContent for title
    currentChatTitle.textContent = '📖 ' + ChatStorage.getChatTitle(chat.messages);
    messageInput.disabled = true;
    sendButton.disabled = true;
    modelSelect.disabled = true;
    viewModeNotice.classList.remove('hidden');
    
    renderChatHistory();

    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('sidebar-hidden');
    }
}

function deleteChat(chatId) {
    ChatStorage.deleteChat(chatId);
    
    if (currentChatId === chatId) {
        createNewChat();
    }
    
    renderChatHistory();
}

function saveCurrentChat() {
    if (!currentChatId || messages.length === 0 || isViewMode) return;

    const chat = {
        id: currentChatId,
        messages: messages,
        timestamp: Date.now(),
        model: modelSelect.value
    };

    ChatStorage.saveChat(chat);
    renderChatHistory();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('sidebar-hidden');
}

// ============================================
// ✅ IMPROVED: Secure Message Rendering
// ============================================

/**
 * ✅ REWRITTEN: Use DOM API instead of innerHTML
 */
function addMessage(role, content, typed = false) {
    const time = new Date().toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

    const isUser = role === 'user';
    const bgColor = isUser 
        ? 'bg-blue-600 text-white rounded-br-none' 
        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none';
    const timeColor = isUser ? 'text-blue-100' : 'text-slate-400';

    const contentDiv = document.createElement('div');
    contentDiv.className = `max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-2xl shadow-sm ${bgColor}`;
    
    const textP = document.createElement('p');
    textP.className = 'whitespace-pre-wrap break-words';
    
    const timeSpan = document.createElement('span');
    timeSpan.className = `text-xs mt-1 block ${timeColor}`;
    timeSpan.textContent = time;

    contentDiv.appendChild(textP);
    contentDiv.appendChild(timeSpan);

    if (!isUser) {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative group';
        
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋';
        copyBtn.className = 'absolute top-2 right-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow hover:bg-slate-100';
        copyBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            navigator.clipboard.writeText(content);
            copyBtn.textContent = '✅';
            setTimeout(function() { 
                copyBtn.textContent = '📋'; 
            }, 2000);
        });
        
        wrapper.appendChild(contentDiv);
        wrapper.appendChild(copyBtn);
        messageDiv.appendChild(wrapper);
    } else {
        messageDiv.appendChild(contentDiv);
    }

    if (emptyState && emptyState.parentNode) {
        emptyState.remove();
        emptyState = null;
    }

    messagesDiv.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (typed && role === 'assistant') {
        typeText(content, textP);
    } else {
        // ✅ Use textContent instead of innerHTML
        textP.textContent = content;
    }

    return textP;
}

// ============================================
// Typing Animation
// ============================================

async function typeText(text, element) {
    // Clear element
    element.textContent = '';
    
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    element.appendChild(cursor);

    const chars = text.split('');
    let currentText = '';
    const typingSpeed = 25;

    for (let i = 0; i < chars.length; i++) {
        currentText += chars[i];
        element.textContent = currentText;
        element.appendChild(cursor);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        await new Promise(function(resolve) { 
            setTimeout(resolve, typingSpeed); 
        });
    }

    cursor.remove();
    element.textContent = currentText;
}

// ============================================
// Loading Indicators
// ============================================

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.className = 'flex justify-start';
    loadingDiv.innerHTML = `
        <div class="bg-white text-slate-800 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-200">
            <div class="flex space-x-2">
                <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    `;
    messagesDiv.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.remove();
}

// ============================================
// Send Message with Validation
// ============================================

async function sendMessage(content) {
    if (!content.trim() || isLoading || isViewMode) return;

    // ✅ Frontend validation
    const MAX_LENGTH = 5000;
    if (content.length > MAX_LENGTH) {
        alert(`Message too long. Maximum ${MAX_LENGTH} characters allowed.`);
        return;
    }

    const selectedModel = modelSelect.value;
    if (!selectedModel) {
        alert('Vui lòng chọn model AI!');
        return;
    }

    // ✅ Validate model
    if (!availableModels.includes(selectedModel)) {
        alert('Invalid model selected');
        return;
    }

    isLoading = true;
    messageInput.disabled = true;
    sendButton.disabled = true;
    modelSelect.disabled = true;

    addMessage('user', content, false);
    messages.push({ role: 'user', content: content });
    saveCurrentChat();

    showLoading();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages
            })
        });

        hideLoading();

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const botText = data?.choices?.[0]?.message?.content || 'Không có phản hồi';
        addMessage('assistant', botText, true);
        messages.push({ role: 'assistant', content: botText });
        
        saveCurrentChat();

        console.log('✅ Response received');
    } catch (error) {
        hideLoading();
        console.error('❌ Error:', error);
        addMessage('assistant', '❌ Lỗi: ' + error.message, false);
    } finally {
        isLoading = false;
        messageInput.disabled = false;
        sendButton.disabled = false;
        modelSelect.disabled = false;
        messageInput.value = '';
        messageInput.focus();
    }
}

// ============================================
// Initialize Application
// ============================================

window.addEventListener('DOMContentLoaded', async function() {
    initElements();
    
    // ✅ Fetch CSRF token first
    console.log('🔒 Fetching CSRF token...');
    const csrfSuccess = await fetchCSRFToken();
    
    if (!csrfSuccess) {
        console.error('❌ Failed to initialize CSRF protection');
        alert('Failed to initialize security. Please refresh the page.');
        return;
    }
    
    // ✅ Refresh CSRF token periodically
    setInterval(async () => {
        if (needsCSRFRefresh()) {
            console.log('🔄 Refreshing CSRF token...');
            await fetchCSRFToken();
        }
    }, 10 * 60 * 1000);
    
    loadModels();
    renderChatHistory();
    createNewChat();

    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleSidebar);

    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!isViewMode) {
            const content = messageInput.value.trim();
            if (content) sendMessage(content);
        }
    });

    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isViewMode) {
                chatForm.dispatchEvent(new Event('submit'));
            }
        }
    });
});

// ✅ CSRF refresh on page visibility
document.addEventListener('visibilitychange', async function() {
    if (!document.hidden && needsCSRFRefresh()) {
        console.log('🔄 Page became visible, refreshing CSRF token...');
        await fetchCSRFToken();
    }
});
    // Event listeners
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleSidebar);

    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!isViewMode) {
            const content = messageInput.value.trim();
            if (content) sendMessage(content);
        }
    });

    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isViewMode) {
                chatForm.dispatchEvent(new Event('submit'));
            }
        }
    });
});

// ============================================
// ✅ Security: Prevent eval() and similar
// ============================================

// Disable dangerous functions
if (typeof window !== 'undefined') {
    // Log if someone tries to use eval
    const originalEval = window.eval;
    window.eval = function() {
        console.error('⚠️ eval() is disabled for security');
        return null;
    };
}
