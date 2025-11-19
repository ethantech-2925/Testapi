<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat Assistant</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        .animate-bounce {
            animation: bounce 1s infinite;
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
    <div id="app" class="container mx-auto px-4 py-8 max-w-4xl">
        <header class="text-center mb-8">
            <h1 class="text-4xl font-bold text-slate-800 mb-2">AI Chat Assistant</h1>
            <p class="text-slate-600">Powered by OpenRouter AI</p>
        </header>

        <div class="w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                <h2 class="text-white font-semibold text-lg">Trò chuyện với AI</h2>
                <p class="text-blue-100 text-sm">Hỏi bất cứ điều gì bạn muốn biết</p>
            </div>

            <div id="messages" class="h-96 overflow-y-auto p-4 space-y-4 bg-slate-50">
                <div class="text-center text-slate-400 mt-20" id="empty-state">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p>Bắt đầu cuộc trò chuyện</p>
                </div>
            </div>

            <div class="p-4 bg-white border-t border-slate-200">
                <form id="chat-form" class="flex gap-2">
                    <input
                        type="text"
                        id="message-input"
                        placeholder="Nhập tin nhắn..."
                        class="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                    />
                    <button
                        type="submit"
                        id="send-button"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    </div>

    <script src="/app.js"></script>
</body>
</html>
