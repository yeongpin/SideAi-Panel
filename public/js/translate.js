class TranslateUI {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'translate-container';
        this.container.style.display = 'none';
        this.translation = ''; // 添加翻譯結果的狀態
        this.debounceTimer = null; // 添加防抖計時器
        this.translationMethod = 'google'; // 默認使用 Google 翻譯
        this.models = []; // 存儲模型列表
        
        // 初始化時加載配置
        this.init();
    }

    async init() {
        try {
            // 首先創建基本 UI
            this.createUI();
            
            // 然後加載配置和模型
            const response = await fetch('../config.json');
            const config = await response.json();
            this.API_BASE_URL = `http://localhost:11435`;
            
            // 獲取並更新模型列表
            await this.fetchModels();
        } catch (error) {
            console.error('Error during initialization:', error);
            this.API_BASE_URL = 'http://localhost:11435';
        }

        // 最後設置事件監聽器
        this.setupEventListeners();
    }

    createUI() {
        this.container.innerHTML = `
            <div class="translate-layout">
                <div class="translate-section">
                    <div class="translate-header">
                        <div class="translate-options">
                            <select class="translate-method-select" id="translateMethod">
                                <option value="google">Google Translate</option>
                                <option value="ollama">AI Model</option>
                            </select>
                            <select class="model-select" id="modelSelect" style="display: none">
                                <option value="">Loading models...</option>
                            </select>
                        </div>
                        <div class="translate-languages">
                            <select class="language-select" id="fromLanguage">
                                <option value="auto">Auto Detect</option>
                                <option value="en">English</option>
                                <option value="zh-TW">Chinese (Traditional)</option>
                                <option value="zh-CN">Chinese (Simplified)</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                            </select>
                            <button class="swap-button" id="swapLanguages">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
                                </svg>
                            </button>
                            <select class="language-select" id="toLanguage">
                                <option value="en">English</option>
                                <option value="zh-TW" selected>Chinese (Traditional)</option>
                                <option value="zh-CN">Chinese (Simplified)</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                            </select>
                        </div>
                    </div>
                    <textarea 
                        id="sourceText" 
                        class="translate-textarea" 
                        placeholder="Enter text to translate..."
                    ></textarea>
                </div>
                <div class="translate-section">
                    <div class="translate-header">
                        <span class="translate-label">Translation</span>
                        <button class="copy-button" id="copyTranslation">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                    <div id="translationResult" class="translation-result"></div>
                </div>
            </div>
        `;
    }

    async fetchModels() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/proxy/ollama/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            // 確保 models 是一個數組並且包含正確的模型名稱
            this.models = Array.isArray(data.models) ? 
                data.models.map(model => typeof model === 'string' ? model : model.name || '') :
                [];
            
            // 過濾掉空字符串
            this.models = this.models.filter(model => model);
            
            // 更新模型選擇下拉框
            const modelSelect = this.container.querySelector('#modelSelect');
            if (modelSelect && this.models.length > 0) {
                modelSelect.innerHTML = this.models
                    .map(model => `<option value="${model}">${model}</option>`)
                    .join('');
                
                // 自動選擇第一個模型
                modelSelect.value = this.models[0];
                
                console.log('Models loaded:', this.models);
            } else if (modelSelect) {
                modelSelect.innerHTML = '<option value="">No models available</option>';
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            const modelSelect = this.container.querySelector('#modelSelect');
            if (modelSelect) {
                modelSelect.innerHTML = '<option value="">Error loading models</option>';
            }
        }
    }

    setupEventListeners() {
        const sourceText = this.container.querySelector('#sourceText');
        const swapButton = this.container.querySelector('#swapLanguages');
        const copyButton = this.container.querySelector('#copyTranslation');
        const fromLanguage = this.container.querySelector('#fromLanguage');
        const toLanguage = this.container.querySelector('#toLanguage');
        const methodSelect = this.container.querySelector('#translateMethod');
        const modelSelect = this.container.querySelector('#modelSelect');

        // 使用防抖處理輸入事件
        sourceText.addEventListener('input', () => {
            this.translation = '';
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.handleTranslate();
            }, 500); // 500ms 的延遲
        });
        
        // 語言選擇變化時立即翻譯
        fromLanguage.addEventListener('change', () => {
            this.translation = '';
            this.container.querySelector('#translationResult').textContent = '';
            clearTimeout(this.debounceTimer);
            this.handleTranslate();
        });
        
        toLanguage.addEventListener('change', () => {
            this.translation = '';
            this.container.querySelector('#translationResult').textContent = '';
            clearTimeout(this.debounceTimer);
            this.handleTranslate();
        });

        swapButton.addEventListener('click', () => {
            clearTimeout(this.debounceTimer);
            this.swapLanguages();
        });
        copyButton.addEventListener('click', () => this.copyTranslation());

        // 修改翻譯方式選擇的事件監聽
        methodSelect.addEventListener('change', () => {
            this.translationMethod = methodSelect.value;
            // 切換模型選擇的顯示
            modelSelect.style.display = this.translationMethod === 'ollama' ? 'block' : 'none';
            
            // 如果切換到 AI Model 且有可用模型，自動選擇第一個模型
            if (this.translationMethod === 'ollama' && this.models.length > 0) {
                modelSelect.value = this.models[0];
            }

            // 如果有輸入文本，則進行翻譯
            if (this.container.querySelector('#sourceText').value.trim()) {
                this.handleTranslate();
            }
        });

        // 添加模型選擇變化的監聽器
        modelSelect.addEventListener('change', () => {
            if (this.container.querySelector('#sourceText').value.trim()) {
                this.handleTranslate();
            }
        });
    }

    async handleTranslate() {
        const sourceText = this.container.querySelector('#sourceText').value;
        const fromLang = this.container.querySelector('#fromLanguage').value;
        const toLang = this.container.querySelector('#toLanguage').value;
        const resultElement = this.container.querySelector('#translationResult');
        
        if (!sourceText.trim()) {
            resultElement.textContent = '';
            this.translation = '';
            return;
        }

        try {
            if (this.translationMethod === 'google') {
                await this.handleGoogleTranslate(sourceText, fromLang, toLang, resultElement);
            } else {
                await this.handleOllamaTranslate(sourceText, fromLang, toLang, resultElement);
            }
        } catch (error) {
            console.error('Translation error:', error);
            resultElement.textContent = 'Translation failed. Please try again.';
            this.translation = '';
        }
    }

    async handleGoogleTranslate(sourceText, fromLang, toLang, resultElement) {
        // 原來的 Google 翻譯邏輯
        const url = new URL('https://translate.googleapis.com/translate_a/single');
        url.searchParams.append('client', 'gtx');
        url.searchParams.append('sl', fromLang === 'auto' ? 'auto' : fromLang);
        url.searchParams.append('tl', toLang);
        url.searchParams.append('dt', 't');
        url.searchParams.append('q', sourceText);

        const response = await fetch(`${this.API_BASE_URL}/proxy/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url.toString() })
        });

        if (!response.ok) throw new Error('Translation failed');

        const data = await response.json();
        this.translation = data[0].map(item => item[0]).join('');
        resultElement.textContent = this.translation;
    }

    async handleOllamaTranslate(sourceText, fromLang, toLang, resultElement) {
        const modelSelect = this.container.querySelector('#modelSelect');
        const selectedModel = modelSelect.value;

        // 添加加載指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'typing-indicator';
        loadingIndicator.innerHTML = '<span></span><span></span><span></span>';
        resultElement.innerHTML = '';
        resultElement.appendChild(loadingIndicator);

        try {
            const response = await fetch(`${this.API_BASE_URL}/proxy/ollama/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt: `Translate the following text from ${fromLang} to ${toLang}:\n${sourceText}`,
                    stream: true,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9
                    }
                })
            });

            if (!response.ok) throw new Error('Translation failed');

            let translation = '';
            let isThinking = false;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (!data.done) {
                                const response = data.response;
                                
                                // 檢查是否包含思考標記
                                if (response.includes('<think>')) {
                                    isThinking = true;
                                    continue;
                                }
                                
                                if (response.includes('</think>')) {
                                    isThinking = false;
                                    continue;
                                }
                                
                                // 如果不是在思考狀態，則添加翻譯內容
                                if (!isThinking) {
                                    translation += response;
                                    // 清理多餘的空格和換行
                                    const cleanedTranslation = translation
                                        .replace(/\s+/g, ' ')  // 將多個空格替換為單個空格
                                        .trim();              // 移除首尾空格
                                    resultElement.textContent = cleanedTranslation;
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing line:', e);
                        }
                    }
                }
            }

            // 移除加載指示器
            if (loadingIndicator.parentNode === resultElement) {
                resultElement.removeChild(loadingIndicator);
            }

            // 最後再清理一次結果
            this.translation = translation
                .replace(/\s+/g, ' ')
                .trim();
            resultElement.textContent = this.translation;

        } catch (error) {
            console.error('Translation error:', error);
            resultElement.textContent = 'Translation failed. Please try again.';
            this.translation = '';
        }
    }

    swapLanguages() {
        const fromLang = this.container.querySelector('#fromLanguage');
        const toLang = this.container.querySelector('#toLanguage');
        const temp = fromLang.value;
        
        if (temp !== 'auto') {
            fromLang.value = toLang.value;
            toLang.value = temp;
            this.translation = ''; // 清除之前的翻譯
            this.container.querySelector('#translationResult').textContent = '';
            this.handleTranslate();
        }
    }

    async copyTranslation() {
        const translation = this.container.querySelector('#translationResult').textContent;
        if (translation) {
            try {
                await navigator.clipboard.writeText(translation);
                const copyButton = this.container.querySelector('#copyTranslation');
                const originalHTML = copyButton.innerHTML;
                
                copyButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                `;
                
                setTimeout(() => {
                    copyButton.innerHTML = originalHTML;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }
}

// 導出實例
export const translateUI = new TranslateUI(); 