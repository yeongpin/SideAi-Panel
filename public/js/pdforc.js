class PdfOcrUI {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'pdforc-container';
        this.container.style.display = 'none';
        this.pdfLoaded = false;
        this.init();
        this.loadPdfJs();
    }

    async loadPdfJs() {
        if (!window.pdfjsLib) {
            // 加載 PDF.js 庫
            const script = document.createElement('script');
            script.src = 'src/pdf.min.js';
            document.head.appendChild(script);

            await new Promise((resolve, reject) => {
                script.onload = () => {
                    // 設置 PDF.js worker
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'src/pdf.worker.min.js';
                    this.pdfLoaded = true;
                    resolve();
                };
                script.onerror = reject;
            });
        } else {
            this.pdfLoaded = true;
        }
    }

    init() {
        this.container.innerHTML = `
            <div class="pdforc-layout">
                <div class="upload-section">
                    <div class="upload-area" id="uploadArea">
                        <input type="file" id="fileInput" accept=".pdf" style="display: none">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <line x1="10" y1="9" x2="8" y2="9"/>
                        </svg>
                        <p>Drop PDF here<br>or click to upload</p>
                    </div>
                    <div class="progress-container" style="display: none;">
                        <div class="progress-bar"></div>
                        <div class="progress-text">Processing: 0%</div>
                    </div>
                </div>
                <div class="result-section">
                    <div class="result-header">
                        <span class="result-label">Extracted Text</span>
                        <button class="copy-button" id="copyResult">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                    <div id="extractedText" class="extracted-text"></div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadArea = this.container.querySelector('#uploadArea');
        const fileInput = this.container.querySelector('#fileInput');
        const copyButton = this.container.querySelector('#copyResult');

        // 點擊上傳區域觸發文件選擇
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // 處理文件拖放
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        // 處理文件選擇
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // 處理複製按鈕
        copyButton.addEventListener('click', async () => {
            const text = this.container.querySelector('#extractedText').textContent;
            if (text) {
                try {
                    await navigator.clipboard.writeText(text);
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
        });
    }

    async handleFile(file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }

        const extractedText = this.container.querySelector('#extractedText');
        const progressContainer = this.container.querySelector('.progress-container');
        const progressBar = this.container.querySelector('.progress-bar');
        const progressText = this.container.querySelector('.progress-text');

        extractedText.textContent = '';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = 'Processing: 0%';

        try {
            if (!this.pdfLoaded) {
                await this.loadPdfJs();
            }
            await this.handlePdf(file, progressBar, progressText);
        } catch (error) {
            console.error('File processing error:', error);
            extractedText.textContent = 'Error processing file. Please try again.';
        } finally {
            progressContainer.style.display = 'none';
        }
    }

    async handlePdf(file, progressBar, progressText) {
        const extractedText = this.container.querySelector('#extractedText');
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';
            const totalPages = pdf.numPages;

            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `Page ${i}:\n${pageText}\n\n`;

                // 更新進度
                const progress = Math.round((i / totalPages) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `Processing: ${progress}%`;
            }

            extractedText.textContent = fullText.trim();
        } catch (error) {
            console.error('PDF processing error:', error);
            throw error;
        }
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }
}

export const pdfOcrUI = new PdfOcrUI(); 