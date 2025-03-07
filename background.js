chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 監聽快捷鍵
chrome.commands.onCommand.addListener((command) => {
    if (command === "_execute_action") {
        // 檢查側邊欄是否已經打開
        chrome.sidePanel.getOptions({}, (options) => {
            if (!options.enabled) {
                // 如果側邊欄未打開，則打開它
                chrome.sidePanel.open();
            }
        });
    }
}); 