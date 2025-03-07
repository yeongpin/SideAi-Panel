import { translateUI } from './translate.js';
import { pdfOcrUI } from './pdforc.js';

let config;

const STORAGE_KEY = 'ai_chat_history';

document.addEventListener('DOMContentLoaded', async function() {
    // 首先加載配置
    try {
        const configResponse = await fetch('../config.json');
        config = await configResponse.json();
    } catch (error) {
        console.error('Error loading config:', error);
        // 使用默認配置
        config = {
            server: {
                host: '192.168.5.182',
                port: '11434'
            },
            prompts: {
                system: '',
                welcome: 'Hello! How can I help you today?'
            },
            models: {
                default: 'deepseek-r1:7b'
            },
            ui: {
                theme: {
                    default: 'system'
                },
                maxHeight: {
                    textarea: 120,
                    codeBlock: 300
                }
            }
        };
    }

    // 初始化 DOM 元素引用
    const elements = {
        messagesContainer: document.getElementById('messagesContainer'),
        userInput: document.getElementById('userInput'),
        sendButton: document.getElementById('sendButton'),
        modelSelect: document.getElementById('modelSelect'),
        newChatButton: document.getElementById('newChatButton'),
        historyButton: document.getElementById('historyButton'),
        historyModal: document.getElementById('historyModal'),
        chatList: document.getElementById('chatList'),
        themeButton: document.getElementById('themeButton'),
        settingsButton: document.getElementById('settingsButton'),
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        chatContainer: document.querySelector('.chat-container')
    };

    // 檢查必要元素是否存在
    if (!elements.messagesContainer || !elements.userInput || !elements.sendButton) {
        console.error('Required DOM elements not found');
        return;
    }

    // 添加翻譯界面和 PDF/OCR 界面到容器中
    if (elements.chatContainer) {
        const mainContent = elements.chatContainer.querySelector('.main-content');
        if (mainContent) {
            const bottomContainer = mainContent.querySelector('.bottom-container');
            if (bottomContainer) {
                mainContent.insertBefore(translateUI.container, bottomContainer);
                mainContent.insertBefore(pdfOcrUI.container, bottomContainer);
            }
        }
    }

    const closeButton = elements.historyModal.querySelector('.close-button');
    let isLoading = false;

    // 修改 API 地址和配置
    const API_BASE_URL = 'http://localhost:11435';
    const OLLAMA_CONFIG = {
        host: '192.168.5.182',
        port: '11434'
    };

    // 獲取可用的模型列表
    async function fetchModels() {
        try {
            const response = await fetch(`${API_BASE_URL}/proxy/ollama/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            console.log('Models response:', data);
            
            // 清空現有選項
            elements.modelSelect.innerHTML = '';
            
            // 檢查數據結構並相應處理
            const models = data.models || [];
            
            if (models.length === 0) {
                elements.modelSelect.innerHTML = '<option value="">No models available</option>';
                return;
            }
            
            // 添加模型選項
            models.forEach(model => {
                const option = document.createElement('option');
                // 檢查模型數據結構
                const modelName = typeof model === 'string' ? model : (model.name || model.model || '');
                option.value = modelName;
                option.textContent = modelName;
                elements.modelSelect.appendChild(option);
            });

            // 使用已加载的配置中的默认模型
            const defaultModel = config.models?.default || '';
            
            // 如果有默认模型且在列表中，则选择它
            if (defaultModel && elements.modelSelect.querySelector(`option[value="${defaultModel}"]`)) {
                elements.modelSelect.value = defaultModel;
            } else {
                // 否则选择第一个模型作为默认值
                if (elements.modelSelect.options.length > 0) {
                    elements.modelSelect.selectedIndex = 0;
                }
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            elements.modelSelect.innerHTML = '<option value="">Error loading models</option>';
        }
    }

    // 初始化時獲取模型列表
    fetchModels();

    // Add welcome message
    addMessage(config.prompts.welcome, 'ai');

    // 添加會話ID
    const sessionId = 'session_' + Date.now();

    // 添加一個變量來存儲當前會話的消息歷史
    let chatMessages = [];

    // Handle send button click
    elements.sendButton.addEventListener('click', sendMessage);

    // Handle enter key
    elements.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter，允許換行
                setTimeout(adjustTextareaHeight, 0);
            } else {
                // 普通Enter，發送消息
                e.preventDefault();
                sendMessage();
            }
        }
    });

    // Handle input height
    elements.userInput.addEventListener('input', adjustTextareaHeight);
    elements.userInput.addEventListener('change', adjustTextareaHeight);
    elements.userInput.addEventListener('focus', adjustTextareaHeight);
    elements.userInput.addEventListener('blur', adjustTextareaHeight);

    // 立即調整 textarea 高度
    adjustTextareaHeight();

    // 配置 highlight.js
    hljs.configure({
        languages: ['javascript', 'html', 'xml', 'css', 'python', 'java', 'cpp', 'json'],
        ignoreUnescapedHTML: true
    });

    // 配置 marked
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { 
                        language: lang,
                        ignoreIllegals: true 
                    }).value;
                } catch (e) {
                    console.error('Highlight error:', e);
                }
            }
            return hljs.highlightAuto(code).value;
        },
        langPrefix: 'hljs language-'
    });

    // 包裝代碼塊的函數
    function wrapCodeBlock(html) {
        let codeBlockCount = 0;
        return html.replace(/<pre><code[^>]*class="[^"]*language-([^"]*)"[^>]*>([\s\S]*?)<\/code><\/pre>/g, 
            (match, language, code) => {
                const id = `code-${Date.now()}-${codeBlockCount++}`;
                return `
                    <pre>
                        <code id="${id}" class="hljs language-${language || 'text'}">${code}</code>
                        <div class="code-container-bottom">
                            <div class="code-language">${language || 'text'}</div>
                            <div class="code-actions">
                                <button class="code-copy-button" data-code-id="${id}" title="Copy">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    
                                </button>
                            </div>
                        </div>
                    </pre>
                `;
            }
        );
    }

    // 複製代碼功能
    function setupCodeCopyButtons() {
        document.querySelectorAll('.code-copy-button').forEach(button => {
            if (!button.hasListener) {
                button.addEventListener('click', async () => {
                    const codeId = button.getAttribute('data-code-id');
                    const codeBlock = document.getElementById(codeId);
                    const code = codeBlock.textContent;
                    
                    try {
                        await navigator.clipboard.writeText(code);
                        const originalHTML = button.innerHTML;
                        button.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 6L9 17l-5-5"/>
                            </svg>
                        `;
                        button.disabled = true;
                        
                        setTimeout(() => {
                            button.innerHTML = originalHTML;
                            button.disabled = false;
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy:', err);
                    }
                });
                button.hasListener = true;
            }
        });
    }

    // 修改 addMessage 函數
    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (role === 'ai') {
            // 對AI回覆使用Markdown渲染
            let rawHtml = marked.parse(text);
            rawHtml = wrapCodeBlock(rawHtml);
            let safeHtml = DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: ['button', 'div', 'span', 'svg', 'rect', 'path', 'div'],
                ADD_ATTR: ['class', 'id', 'data-code-id', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'title']
            });
            contentDiv.innerHTML = safeHtml;

            // 應用代碼高亮
            contentDiv.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });

            // 設置複製按鈕
            setupCodeCopyButtons();

            // 添加思考块的点击事件
            contentDiv.querySelectorAll('.toggle-thinking').forEach(button => {
                if (!button.hasListener) {
                    button.addEventListener('click', () => {
                        const content = button.parentElement.nextElementSibling;
                        const isHidden = content.style.display === 'none';
                        content.style.display = isHidden ? 'block' : 'none';
                        button.textContent = isHidden ? '▼' : '▶';
                    });
                    button.hasListener = true;
                }
            });
        } else {
            contentDiv.textContent = text;
        }
        
        messageDiv.appendChild(contentDiv);
        elements.messagesContainer.appendChild(messageDiv);
        
        scrollToBottom();
    }

    // 移除全局 copyCode 函數
    window.copyCode = undefined;

    let currentChatId = Date.now().toString();
    let chatHistory = loadChatHistory();

    // 加載聊天歷史
    function loadChatHistory() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }

    // 保存聊天歷史
    function saveChatHistory() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    }

    // 修改 createNewChat 函數
    function createNewChat() {
        const messages = elements.messagesContainer.querySelectorAll('.message');
        if (messages.length > 1) {
            // 創建臨時容器來處理 HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = elements.messagesContainer.innerHTML;
            
            // 確保代碼塊內容被正確轉義
            tempContainer.querySelectorAll('pre code').forEach(codeBlock => {
                codeBlock.textContent = codeBlock.textContent;
            });

            const currentChat = {
                id: currentChatId,
                title: 'New Chat',
                messages: tempContainer.innerHTML,
                lastUpdated: Date.now()
            };

            // 設置標題為第一條用戶消息
            const firstUserMessage = Array.from(messages).find(msg => msg.classList.contains('user'));
            if (firstUserMessage) {
                currentChat.title = firstUserMessage.querySelector('.message-content').textContent.slice(0, 50);
            }

            const existingChatIndex = chatHistory.findIndex(c => c.id === currentChatId);
            if (existingChatIndex === -1) {
                chatHistory.push(currentChat);
            } else {
                chatHistory[existingChatIndex] = currentChat;
            }
            saveChatHistory();
        }
        chatMessages = []; // 重置消息歷史
        currentChatId = Date.now().toString();
        elements.messagesContainer.innerHTML = '';
        addMessage(config.prompts.welcome, 'ai');
    }

    // 修改 updateChatTitle 函數
    function updateChatTitle(chatId, firstUserMessage) {
        const chat = chatHistory.find(c => c.id === chatId);
        if (chat) {
            chat.title = firstUserMessage.slice(0, 50);  // 使用用戶的第一句話作為標題
            chat.lastUpdated = Date.now();
            saveChatHistory();
        }
    }

    // 顯示歷史記錄
    function showHistory() {
        elements.chatList.innerHTML = '';
        const sortedHistory = [...chatHistory].sort((a, b) => b.lastUpdated - a.lastUpdated);
        
        sortedHistory.forEach(chat => {
            // 創建臨時容器來計算消息數量
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chat.messages;
            const messageCount = tempDiv.querySelectorAll('.message').length;

            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.innerHTML = `
                <div class="chat-item-title">${chat.title || 'New Chat'}</div>
                <div class="chat-item-info">
                    <span class="chat-item-message-count">${messageCount} messages</span>
                    <span class="chat-item-date">${new Date(chat.lastUpdated).toLocaleString()}</span>
                </div>
                <button class="delete-button" title="Delete chat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            `;

            // 添加點擊事件處理
            chatItem.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-button')) {
                    loadChat(chat.id);
                }
            });

            // 添加刪除按鈕事件
            const deleteButton = chatItem.querySelector('.delete-button');
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteChat(chat.id);
            });

            elements.chatList.appendChild(chatItem);
        });
        
        elements.historyModal.style.display = 'block';
    }

    // 加載特定聊天
    function loadChat(chatId) {
        const chat = chatHistory.find(c => c.id === chatId);
        if (chat) {
            chatMessages = []; // 重置消息歷史
            currentChatId = chatId;
            
            // 解析並重建消息歷史
            const parser = new DOMParser();
            const doc = parser.parseFromString(chat.messages, 'text/html');
            const messages = doc.querySelectorAll('.message');
            
            messages.forEach(msg => {
                const content = msg.querySelector('.message-content').textContent;
                const role = msg.classList.contains('user') ? 'user' : 'assistant';
                chatMessages.push({ role, content });
            });
            
            elements.messagesContainer.innerHTML = doc.body.innerHTML;
            
            // 重新應用代碼高亮
            elements.messagesContainer.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
            
            // 重新綁定所有代碼塊的複製按鈕
            setupCodeCopyButtons();

            elements.historyModal.style.display = 'none';
            scrollToBottom();
        }
    }

    // 事件監聽器
    elements.newChatButton.addEventListener('click', createNewChat);
    elements.historyButton.addEventListener('click', showHistory);
    closeButton.addEventListener('click', () => {
        elements.historyModal.style.display = 'none';
    });

    // 點擊模態框外部關閉
    window.addEventListener('click', (e) => {
        if (e.target === elements.historyModal) {
            elements.historyModal.style.display = 'none';
        }
    });

    // 添加网络访问状态
    let webAccessEnabled = false;

    // 获取当前日期时间
    function getCurrentDateTime() {
        const now = new Date();
        return now.toLocaleString();
    }

    // 获取网络搜索结果
    async function getWebSearchResults(query) {
        try {
            const response = await fetch(`${API_BASE_URL}/proxy/web-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });
            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error('Web search error:', error);
            return null;
        }
    }

    // 修改 sendMessage 函数
    async function sendMessage() {
        if (isLoading || !elements.userInput.value.trim()) return;

        const userMessage = elements.userInput.value.trim();
        
        // 添加用户消息到历史
        chatMessages.push({
            role: 'user',
            content: userMessage
        });
        
        addMessage(userMessage, 'user');
        elements.userInput.value = '';
        adjustTextareaHeight();
        
        isLoading = true;
        elements.sendButton.disabled = true;
        showTypingIndicator();

        try {
            const settings = JSON.parse(localStorage.getItem('settings') || '{}');
            const systemPrompt = settings.systemPrompt || config.prompts.system;

            // 如果启用了网络访问，添加当前时间和网络搜索结果
            let additionalContext = '';
            if (webAccessEnabled) {
                additionalContext = `Current date and time: ${getCurrentDateTime()}\n\n`;
                
                // 如果消息中包含需要搜索的内容，进行网络搜索
                const searchResults = await getWebSearchResults(userMessage);
                if (searchResults) {
                    additionalContext += `Web search results:\n${searchResults}\n\n`;
                }
            }

            // 构建完整的上下文提示
            let contextPrompt = '';
            if (chatMessages.length > 1) {
                contextPrompt = chatMessages.slice(0, -1).map(msg => {
                    const role = msg.role === 'user' ? 'Human' : 'Assistant';
                    return `${role}: ${msg.content}`;
                }).join('\n\n');
                contextPrompt += '\n\n';
            }

            // 添加网络上下文和当前用户消息
            contextPrompt = additionalContext + contextPrompt + `Human: ${userMessage}\n\nAssistant: `;

            const body = {
                model: elements.modelSelect.value,
                prompt: contextPrompt,
                systemPrompt: systemPrompt,
                sessionId: sessionId
            };
            
            const response = await fetch(`${API_BASE_URL}/proxy/ollama/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });
            console.log(JSON.stringify(body));

            let fullResponse = '';
            let currentThinking = '';
            let isInThinkingBlock = false;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // 創建新的消息元素
            removeTypingIndicator();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai';
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            messageDiv.appendChild(contentDiv);
            elements.messagesContainer.appendChild(messageDiv);

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // 只在完成時添加一次 AI 回覆到歷史
                    chatMessages.push({
                        role: 'assistant',
                        content: fullResponse
                    });
                    break;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.done) continue;
                        
                        // 处理思考块
                        if (data.response.includes('<think>')) {
                            isInThinkingBlock = true;
                            if (!contentDiv.querySelector('.thinking-block')) {
                                const thinkingBlock = document.createElement('details');
                                thinkingBlock.className = 'thinking-block';
                                thinkingBlock.innerHTML = `
                                    <summary>
                                        <span class="thinking-indicator">🤔 Thinking...</span>
                                    </summary>
                                    <div class="thinking-content"></div>
                                `;
                                contentDiv.appendChild(thinkingBlock);
                            }
                        }
                        
                        if (isInThinkingBlock) {
                            currentThinking += data.response;
                            if (data.response.includes('</think>')) {
                                isInThinkingBlock = false;
                                const thinkingContent = contentDiv.querySelector('.thinking-content');
                                if (thinkingContent) {
                                    thinkingContent.textContent = currentThinking
                                        .replace('<think>', '')
                                        .replace('</think>', '');
                                }
                                currentThinking = '';
                                // 重置完整响应，只保留非思考内容
                                fullResponse = '';
                            } else {
                                const thinkingContent = contentDiv.querySelector('.thinking-content');
                                if (thinkingContent) {
                                    thinkingContent.textContent = currentThinking;
                                }
                            }
                        } else {
                            // 只在非思考块时累积响应
                            fullResponse += data.response;
                        }
                        
                        // 只在非思考块时更新主要内容
                        if (!isInThinkingBlock) {
                            let rawHtml = marked.parse(fullResponse);
                            rawHtml = wrapCodeBlock(rawHtml);
                            let safeHtml = DOMPurify.sanitize(rawHtml, {
                                ADD_TAGS: ['button', 'div', 'span', 'svg', 'rect', 'path', 'details', 'summary'],
                                ADD_ATTR: ['class', 'id', 'data-code-id', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'title', 'open']
                            });
                            // 保持思考块，只更新其他内容
                            const thinkingBlock = contentDiv.querySelector('.thinking-block');
                            if (thinkingBlock) {
                                // 创建临时容器来解析新内容
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = safeHtml;
                                
                                // 清除旧内容，但保留思考块
                                contentDiv.innerHTML = '';
                                contentDiv.appendChild(thinkingBlock);
                                
                                // 添加新内容
                                while (tempDiv.firstChild) {
                                    if (!tempDiv.firstChild.classList?.contains('thinking-block')) {
                                        contentDiv.appendChild(tempDiv.firstChild);
                                    } else {
                                        tempDiv.removeChild(tempDiv.firstChild);
                                    }
                                }
                            } else {
                                contentDiv.innerHTML = safeHtml;
                            }
                        }

                        // 應用代碼高亮和設置複製按鈕
                        contentDiv.querySelectorAll('pre code').forEach(block => {
                            hljs.highlightElement(block);
                        });
                        setupCodeCopyButtons();
                        scrollToBottom();
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            addMessage('Sorry, there was an error processing your request.', 'ai');
        } finally {
            isLoading = false;
            elements.sendButton.disabled = false;
        }
    }

    
    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message ai typing-indicator-container';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        elements.messagesContainer.appendChild(indicator);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = elements.messagesContainer.querySelector('.typing-indicator-container');
        if (indicator) {
            indicator.remove();
        }
    }

    function scrollToBottom() {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    function adjustTextareaHeight() {
        const textarea = elements.userInput;
        
        // 設置基本行高
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        const paddingTop = parseInt(window.getComputedStyle(textarea).paddingTop);
        const paddingBottom = parseInt(window.getComputedStyle(textarea).paddingBottom);
        
        // 計算單行文本的基本高度
        const singleLineHeight = lineHeight + paddingTop + paddingBottom;
        
        // 如果有換行或按下Shift+Enter
        if (textarea.value.includes('\n')) {
            textarea.style.height = 'auto';
            const newHeight = Math.min(
                Math.max(textarea.scrollHeight, singleLineHeight),
                120
            );
            textarea.style.height = `${newHeight}px`;
        } else {
            // 單行文本時使用固定高度
            textarea.style.height = `${singleLineHeight}px`;
        }
        
        // 根據內容決定是否顯示滾動條
        textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
    }

    // 修改 modal 標題
    document.querySelector('.modal-header h2').textContent = 'History Chats';

    // 添加刪除聊天功能
    function deleteChat(chatId) {
        if (confirm('Are you sure you want to delete this chat?')) {
            chatHistory = chatHistory.filter(chat => chat.id !== chatId);
            saveChatHistory();
            
            // 如果刪除的是當前聊天，創建新聊天
            if (chatId === currentChatId) {
                createNewChat();
            }
            
            // 刷新歷史記錄顯示
            showHistory();
        }
    }

    // 主題切換功能
    function initTheme() {
        // 檢查本地存儲的主題設置
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            // 如果沒有保存的主題，則使用系統主題
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            localStorage.setItem('theme', prefersDark ? 'dark' : 'light');
        }
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    // 初始化主題
    initTheme();

    // 修改主題切換按鈕事件監聽器
    elements.themeButton.addEventListener('click', () => {
        toggleTheme();
    });

    // 監聽系統主題變化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
    });

    // 修改 loadSettings 函數
    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        // 加載常規設置
        document.getElementById('ollamaHost').value = settings.host || config.server.host;
        document.getElementById('ollamaPort').value = settings.port || config.server.port;
        document.getElementById('systemPrompt').value = settings.systemPrompt || config.prompts.system;
        
        // 加載默認模型設置
        document.getElementById('defaultModel').value = settings.defaultModel || config.models.default;
        
        // 加載 UI 設置
        document.getElementById('themeSelect').value = settings.theme || config.ui.theme.default;
        document.getElementById('textareaHeight').value = settings.textareaHeight || config.ui.maxHeight.textarea;
        document.getElementById('codeBlockHeight').value = settings.codeBlockHeight || config.ui.maxHeight.codeBlock;
    }

    // 修改 saveSettings 函數
    function saveSettings() {
        const settings = {
            host: document.getElementById('ollamaHost').value,
            port: document.getElementById('ollamaPort').value,
            systemPrompt: document.getElementById('systemPrompt').value,
            defaultModel: document.getElementById('defaultModel').value,
            theme: document.getElementById('themeSelect').value,
            textareaHeight: parseInt(document.getElementById('textareaHeight').value),
            codeBlockHeight: parseInt(document.getElementById('codeBlockHeight').value)
        };
        
        localStorage.setItem('settings', JSON.stringify(settings));
        
        // 更新 OLLAMA_CONFIG
        OLLAMA_CONFIG.host = settings.host;
        OLLAMA_CONFIG.port = settings.port;
        
        // 更新默認模型
        config.models.default = settings.defaultModel;
        
        // 應用 UI 設置
        applyUISettings(settings);

        // 切換回聊天模式
        handleModeChange('chat');
    }

    // 添加應用 UI 設置的函數
    function applyUISettings(settings) {
        // 應用主題
        document.documentElement.setAttribute('data-theme', settings.theme);
        
        // 更新 CSS 變量
        document.documentElement.style.setProperty('--textarea-max-height', `${settings.textareaHeight}px`);
        document.documentElement.style.setProperty('--code-block-max-height', `${settings.codeBlockHeight}px`);
        
        // 重新調整文本區域高度
        adjustTextareaHeight();
    }

    // 標籤切換
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 更新按鈕狀態
            elements.tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 更新內容顯示
            const tabId = button.dataset.tab;
            elements.tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            // 更新子標題
            const subtitle = document.querySelector('.settings-subtitle');
            subtitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
        });
    });

    // 事件監聽器
    elements.settingsButton.addEventListener('click', () => {
        handleModeChange('settings');
        loadSettings();
    });

    // 添加保存設置按鈕的事件監聽器
    const saveSettingsButton = document.getElementById('saveSettings');
    if (saveSettingsButton) {
        saveSettingsButton.addEventListener('click', saveSettings);
    }

    // 修改模式切換函數
    function handleModeChange(mode) {
        elements.chatContainer.classList.remove('translate-mode', 'pdforc-mode', 'settings-mode');
        translateUI.hide();
        pdfOcrUI.hide();
        
        const settingsContainer = document.getElementById('settingsContainer');
        if (settingsContainer) {
            settingsContainer.style.display = 'none';
        }
        
        // 移除所有標籤的活動狀態
        document.querySelectorAll('.header-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 根據模式激活相應的標籤
        switch (mode) {
            case 'translate':
                elements.chatContainer.classList.add('translate-mode');
                translateUI.show();
                document.querySelector('[data-mode="translate"]').classList.add('active');
                break;
            case 'pdforc':
                elements.chatContainer.classList.add('pdforc-mode');
                pdfOcrUI.show();
                document.querySelector('[data-mode="pdforc"]').classList.add('active');
                break;
            case 'settings':
                elements.chatContainer.classList.add('settings-mode');
                if (settingsContainer) {
                    settingsContainer.style.display = 'flex';
                }
                elements.settingsButton.classList.add('active');
                break;
            case 'chat':
                document.querySelector('[data-mode="chat"]').classList.add('active');
                break;
        }
    }

    // 初始化標籤點擊事件
    document.querySelectorAll('.header-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode) {
                handleModeChange(mode);
            }
        });
    });

    // 添加网络访问按钮事件监听器
    const webAccessButton = document.getElementById('webAccessButton');
    if (webAccessButton) {
        webAccessButton.addEventListener('click', () => {
            webAccessEnabled = !webAccessEnabled;
            webAccessButton.classList.toggle('active', webAccessEnabled);
            // 更新按钮提示
            webAccessButton.title = webAccessEnabled ? 'Disable Web Access' : 'Enable Web Access';
        });
    }
}); 