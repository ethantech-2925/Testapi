// --- GLOBAL ---
let messagesDiv, messagesContainer, emptyState, chatForm, messageInput, sendButton, modelSelect, chatHistory, chatCount, currentChatTitle, viewModeNotice;
let messages = [], isLoading = false, availableModels = [], currentChatId = null, isViewMode = false;
const MAX_CHATS = 300, STORAGE_KEY = 'ai_chat_history';

function initElements(){
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

class ChatStorage{
    static getAllChats(){const data=localStorage.getItem(STORAGE_KEY);return data?JSON.parse(data):[];}
    static saveChat(chat){let chats=this.getAllChats();if(chats.length>=MAX_CHATS){chats=chats.slice(-MAX_CHATS+1);}const idx=chats.findIndex(c=>c.id===chat.id);idx>=0?chats[idx]=chat:chats.push(chat);localStorage.setItem(STORAGE_KEY,JSON.stringify(chats));return chat;}
    static getChat(id){return this.getAllChats().find(c=>c.id===id);}
    static deleteChat(id){let chats=this.getAllChats().filter(c=>c.id!==id);localStorage.setItem(STORAGE_KEY,JSON.stringify(chats));}
    static getChatTitle(messages){if(!messages||messages.length===0)return'Chat mới';const firstUser=messages.find(m=>m.role==='user');if(!firstUser)return'Chat mới';let t=firstUser.content.substring(0,50);return firstUser.content.length>50?t+'...':t;}
}

async function loadModels(){
    try{
        const res=await fetch('/api/models');const data=await res.json();
        availableModels=data.models||[];const defaultModel=data.default;
        modelSelect.innerHTML='';
        availableModels.forEach(m=>{
            const o=document.createElement('option');o.value=m;o.textContent=m.split('/')[1].replace(':free','').replace(/-/g,' ').toUpperCase();if(m===defaultModel)o.selected=true;modelSelect.appendChild(o);
        });
    }catch(e){console.error('❌ Failed to load models:',e);modelSelect.innerHTML='<option value="">Error loading models</option>';}
}

function escapeHtml(text){const div=document.createElement('div');div.textContent=text;return div.innerHTML;}

// ... Các hàm createNewChat, loadChat, deleteChat, saveCurrentChat, addMessage, typeText, sendMessage ... 
// Copy từ file trước, bỏ mọi inline onclick, thay bằng addEventListener

// --- EVENT LISTENERS ---
window.addEventListener('DOMContentLoaded', () => {
    initElements();
    loadModels();
    renderChatHistory();
    createNewChat();

    chatForm.addEventListener('submit', e => {
        e.preventDefault();
        if (!isViewMode) {
            const content = messageInput.value.trim();
            if(content) sendMessage(content);
        }
    });

    messageInput.addEventListener('keydown', e=>{
        if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatForm.dispatchEvent(new Event('submit'));}
    });

    document.getElementById('btn-new-chat').addEventListener('click', createNewChat);
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleSidebar);

    // Delegate cho load và delete chat
    chatHistory.addEventListener('click', e=>{
        const loadBtn = e.target.closest('.btn-load-chat');
        if(loadBtn) loadChat(loadBtn.dataset.id);

        const delBtn = e.target.closest('.btn-delete-chat');
        if(delBtn && confirm('Xóa chat này thật hả bro?')) deleteChat(delBtn.dataset.id);
    });
});
