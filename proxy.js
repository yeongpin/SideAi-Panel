const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 讀取配置文件
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// 存儲對話歷史的Map（使用會話ID作為鍵）
const conversationHistory = new Map();

const app = express();

// 啟用CORS
app.use(cors());

// 添加 body-parser 中間件
app.use(express.json());

// 添加配置獲取路由
app.get('/config', (req, res) => {
    res.json(config);
});

// 添加 Ollama 代理路由
app.post('/proxy/ollama/tags', async (req, res) => {
    try {
        console.log('Fetching models from:', `http://${config.server.host}:${config.server.port}/api/tags`);
        const response = await fetch(`http://${config.server.host}:${config.server.port}/api/tags`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ollama API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Models fetched:', data);
        res.json(data);
    } catch (error) {
        console.error('Ollama proxy error:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});


// 修改 Ollama 生成代理路由
app.post('/proxy/ollama/generate', async (req, res) => {
    try {
        const sessionId = req.body.sessionId || 'default';
        const userMessage = req.body.prompt;
        const systemPrompt = req.body.systemPrompt || '';
        
        // 設置響應頭
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await fetch(`http://${config.server.host}:${config.server.port}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        // 讀取流式響應
        const reader = response.body;
        let currentThinking = '';
        let isInThinkingBlock = false;
        
        reader.on('data', chunk => {
            try {
                const text = chunk.toString();
                const lines = text.split('\n');
                console.log('text:', text);
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            // 嘗試解析 JSON
                            const data = JSON.parse(line);
                            if (data.response) {
                                // 解码 Unicode 转义序列
                                let decodedResponse = data.response
                                    .replace(/\\u003cthink\\u003e/g, '<think>')
                                    .replace(/\\u003c\/think\\u003e/g, '</think>')
                                    .replace(/\u003cthink\u003e/g, '<think>')
                                    .replace(/\u003c\/think\u003e/g, '</think>');
                                
                                // 检查是否在思考块中
                                if (decodedResponse.includes('<think>')) {
                                    data.type = 'thinking';
                                    data.response = decodedResponse.replace(/<think>(.*?)<\/think>/gs, (match, p1) => {
                                        return `<details class="thinking-block">
                                            <summary>
                                                <span class="thinking-indicator">🤔 Thinking...</span>
                                            </summary>
                                            ${p1}
                                        </details>`;
                                    });
                                }
                                else {
                                    data.response = decodedResponse;
                                }
                            }
                            // 發送格式化的 SSE 數據
                            res.write(`data: ${JSON.stringify(data)}\n\n`);
                        } catch (parseError) {
                            console.error('Error parsing JSON:', line);
                            // 如果不是有效的 JSON，跳過這一行
                            continue;
                        }
                    }
                }
            } catch (e) {
                console.error('Error processing chunk:', e);
            }
        });

        reader.on('end', () => {
            res.write('data: {"done": true}\n\n');
            res.end();
        });

        reader.on('error', (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('Ollama proxy error:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

// 添加獲取對話歷史的路由
app.get('/conversation/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const history = conversationHistory.get(sessionId) || [];
    res.json(history);
});

// 添加清除對話歷史的路由
app.delete('/conversation/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    conversationHistory.delete(sessionId);
    res.json({ success: true });
});

// 添加 Google Translate 代理路由
app.post('/proxy/translate', async (req, res) => {
    try {
        const { url } = req.body;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Google Translate proxy error:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

// 添加网络搜索路由
app.post('/proxy/web-search', async (req, res) => {
    try {
        const { query } = req.body;
        
        // 获取当前日期时间
        const currentDate = new Date().toISOString();
        
        // 这里可以集成实际的搜索API，比如 Google Custom Search API 或其他搜索服务
        // 现在我们返回一个模拟的结果
        const searchResults = {
            date: currentDate,
            results: [
                `Current date and time: ${new Date().toLocaleString()}`,
                "This is a simulated web search result.",
                "You can integrate with real search APIs here."
            ].join('\n')
        };
        
        res.json(searchResults);
    } catch (error) {
        console.error('Web search error:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        details: err.stack
    });
});

app.listen(11435, () => {
    console.log('Proxy server running on port 11435');
    console.log('Server config:', config.server);
});