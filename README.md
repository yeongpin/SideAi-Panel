# 🤖 SideAI Panel Chrome Extension

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Chrome](https://img.shields.io/badge/Chrome-v116+-green.svg)

A powerful Chrome extension that brings AI chat capabilities to your browser's side panel. Powered by Ollama, it offers chat, translation, and text extraction features in a sleek, modern interface.

[Installation](#-installation) •
[Features](#-features) •
[Usage](#-usage) •
[Configuration](#-configuration)

</div>

## ✨ Features

### 🎯 AI Chat
- 💬 Real-time chat interface with AI models
- 🔄 Support for multiple Ollama models
- 🎨 Code highlighting with syntax support
- 📝 Markdown rendering
- 📚 Chat history management
- 📋 One-click code copying

### 🌐 Translation
- 🔄 AI-powered text translation
- 🛠 Multiple translation methods
- 🌍 Language pair selection
- 💨 Quick text swap and copy

### 📑 PDF/OCR
- 📄 PDF text extraction
- 📸 Image text recognition (OCR)
- 📊 Progress tracking
- 📋 Easy text copying

### 🎨 User Interface
- 🌓 Light/Dark theme support
- 🔄 System theme detection
- ⚙️ Customizable settings
- 📱 Responsive design
- ⌨️ Keyboard shortcuts (Ctrl+I / Cmd+I)

## 🚀 Installation

1. Clone this repository:
```bash
git clone https://github.com/yeongpin/sideai-panel.git
```

2. Navigate to `chrome://extensions/` in Chrome

3. Enable "Developer mode" in the top right

4. Click "Load unpacked" and select the extension directory

## ⚙️ Configuration

1. Start the Ollama server:
```bash
ollama serve
```

2. Start the proxy server:
```bash
node proxy.js
```

3. Configure the extension settings:
   - 🖥️ Host: Default is `192.168.5.182`
   - 🔌 Port: Default is `11434`
   - 💭 System Prompt: Customize AI behavior
   - 🎨 UI Settings: Adjust theme and dimensions

## 📖 Usage

### 💬 Chat
- Launch: Click extension icon or `Ctrl+I` / `Cmd+I`
- Select model from dropdown
- Send message: `Enter`
- New line: `Shift+Enter`

### 🌐 Translation
- Access: Click Translate tab
- Select languages
- Choose method
- Input text

### 📑 PDF/OCR
- Open PDF/OCR tab
- Upload: Drag & drop or click
- Wait for processing
- Copy extracted text

## 🛠 Development

### 📁 Project Structure
```
├── background.js      # Extension background script
├── config.json        # Configuration file
├── manifest.json      # Extension manifest
├── proxy.js          # Local proxy server
├── sidepanel.html    # Main UI template
├── sidepanel.js      # Main UI logic
├── styles.css        # UI styles
├── translate.js      # Translation module
└── pdforc.js         # PDF/OCR module
```

### 🔧 Technologies
- 🌐 HTML5/CSS3/JavaScript
- 🧩 Chrome Extensions API
- 📝 Marked.js for Markdown
- 🎨 Highlight.js for code
- 📄 PDF.js for PDF processing

## 📋 Requirements
- 🌐 Chrome Browser (v116+)
- 🔄 Node.js
- 🤖 Ollama

## 📄 License
MIT License - feel free to use and modify!

## 🤝 Contributing
1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

---
<div align="center">
Made with ❤️ by yeongpin
</div>