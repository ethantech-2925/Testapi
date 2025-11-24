const messagesDiv = document.getElementById('messages');
const emptyState = document.getElementById('empty-state');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
let messages = [];
let isLoading = false;

function addMessage(role, content) {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

    const isUser = role === 'user';
    const bgColor = isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none';
    const timeColor = isUser ? 'text-blue-100' : 'text-slate-400';

    const contentDiv = document.createElement('div');
    contentDiv.className = `max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-2xl shadow-sm ${bgColor}`;

    const textP = document.createElement('p');
    textP.className = 'whitespace-pre-wrap break-words';
    textP.textContent = content;

    const timeSpan = document.createElement('span');
    timeSpan.className = `text-xs mt-1 block ${timeColor}`;
    timeSpan.textContent = time;

    contentDiv.appendChild(textP);
    contentDiv.appendChild(timeSpan);
    messageDiv.appendChild(contentDiv);

    if (emptyState && emptyState.parentNode) {
        emptyState.remove();
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading';
    loadingDiv.className = 'flex justify-start';

    const loadingContent = document.createElement('div');
    loadingContent.className = 'bg-white text-slate-800 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-200';

    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'flex space-x-2';

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'w-2 h-2 bg-slate-400 rounded-full animate-bounce';
        dot.style.animationDelay = `${i * 0.2}s`;
        dotsContainer.appendChild(dot);
    }

    loadingContent.appendChild(dotsContainer);
    loadingDiv.appendChild(loadingContent);
    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

async function sendMessage(content) {
    if (!content.trim() || isLoading) return;

    isLoading = true;
    messageInput.disabled = true;
    sendButton.disabled = true;

    addMessage('user', content);
    messages.push({ role: 'user', content });

    showLoading();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'z-ai/glm-4.5-air:free',
                messages: messages
            })
        });

        hideLoading();

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const botText = data?.choices?.[0]?.message?.content || 'Không có phản hồi';

        addMessage('assistant', botText);
        messages.push({ role: 'assistant', content: botText });
    } catch (error) {
        hideLoading();
        addMessage('assistant', 'Lỗi: ' + (error?.message || 'Không thể kết nối'));
    } finally {
        isLoading = false;
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.value = '';
        messageInput.focus();
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content) {
        sendMessage(content);
    }
});

messageInput.focus();
