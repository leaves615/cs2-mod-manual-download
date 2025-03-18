// ==UserScript==
// @name         Cities Skylines 2模组一键下载
// @namespace    http://tampermonkey.net/
// @version      2023-03-17
// @description  为Cities Skylines 2的模组清单页面添加一键下载按钮
// @author       GitHub Copilot
// @match        https://mods.paradoxplaza.com/playsets/cities_skylines_2/*
// @match        https://mods.paradoxplaza.com/mods/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=paradoxplaza.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isDownloading = false;
    let downloadCount = 0;
    let totalCount = 0;
    let currentModInfo = null;
    let iframeContainer = null;
    let currentLanguage = 'en'; // 默认语言为英语

    // 翻译字典
    const translations = {
        'en': {
            buttonText: 'Download All Mods',
            downloadingAlert: 'Download is in progress, please wait...',
            noModsFound: 'No mods found! Please make sure the page is fully loaded.',
            confirmDownload: 'Found {0} mods. Start downloading?',
            downloadComplete: 'All mods download completed!',
            downloadError: 'Error during download: {0}',
            progressStatus: 'Progress: {0}/{1}'
        },
        'zh': {
            buttonText: '一键下载所有模组',
            downloadingAlert: '下载正在进行中，请等待完成...',
            noModsFound: '未找到可下载的模组！请确保页面已完全加载。',
            confirmDownload: '找到 {0} 个模组，是否开始下载？',
            downloadComplete: '所有模组下载完成！',
            downloadError: '下载过程中出现错误: {0}',
            progressStatus: '下载进度: {0}/{1}'
        },
        'ja': {
            buttonText: '全てのMODをダウンロード',
            downloadingAlert: 'ダウンロード進行中です。お待ちください...',
            noModsFound: 'MODが見つかりません！ページが完全に読み込まれていることを確認してください。',
            confirmDownload: '{0}個のMODが見つかりました。ダウンロードを開始しますか？',
            downloadComplete: '全てのMODのダウンロードが完了しました！',
            downloadError: 'ダウンロード中にエラーが発生しました: {0}',
            progressStatus: '進捗状況: {0}/{1}'
        },
        'de': {
            buttonText: 'Alle Mods herunterladen',
            downloadingAlert: 'Download läuft, bitte warten...',
            noModsFound: 'Keine Mods gefunden! Bitte stellen Sie sicher, dass die Seite vollständig geladen ist.',
            confirmDownload: '{0} Mods gefunden. Download starten?',
            downloadComplete: 'Download aller Mods abgeschlossen!',
            downloadError: 'Fehler beim Download: {0}',
            progressStatus: 'Fortschritt: {0}/{1}'
        }
    };

    // 格式化字符串函数
    function formatString(str, ...args) {
        return str.replace(/{(\d+)}/g, (match, number) => {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    }

    // 获取翻译文本
    function getText(key, ...args) {
        const lang = translations[currentLanguage] || translations['en'];
        const text = lang[key] || translations['en'][key];
        return formatString(text, ...args);
    }

    // 检测页面语言
    function detectLanguage() {
        // 尝试从HTML lang属性获取
        const htmlLang = document.documentElement.lang.toLowerCase();
        if (htmlLang) {
            if (htmlLang.startsWith('zh')) return 'zh';
            if (htmlLang.startsWith('ja')) return 'ja';
            if (htmlLang.startsWith('de')) return 'de';
        }
        
        // 尝试从URL或导航栏检测
        const url = window.location.href;
        if (url.includes('/zh/') || url.includes('?lang=zh')) return 'zh';
        if (url.includes('/ja/') || url.includes('?lang=ja')) return 'ja';
        if (url.includes('/de/') || url.includes('?lang=de')) return 'de';
        
        // 尝试从页面内容检测
        const pageText = document.body.textContent || '';
        const zhCount = (pageText.match(/[\u4E00-\u9FFF]/g) || []).length;
        const jaCount = (pageText.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
        
        if (zhCount > 100) return 'zh';
        if (jaCount > 100) return 'ja';
        
        // 如果没有明确的语言标记，检查是否有德语特有的单词
        const germanWords = ['Herunterladen', 'Spielen', 'Installieren'];
        for (const word of germanWords) {
            if (pageText.includes(word)) return 'de';
        }
        
        return 'en'; // 默认为英语
    }

    // 等待页面完全加载
    window.addEventListener('load', function() {
        setTimeout(() => {
            currentLanguage = detectLanguage();
            console.log(`检测到语言: ${currentLanguage}`);
            init();
        }, 1000);
    });

    // 主函数
    function init() {
        // 如果是模组详情页且由我们的脚本打开，则自动点击下载按钮
        if (window.location.href.includes('/mods/') && window.location.href.includes('#autodownload')) {
            setTimeout(clickDownloadButtonOnModPage, 2000);
            return;
        }

        // 创建下载按钮
        const downloadButton = document.createElement('button');
        downloadButton.textContent = getText('buttonText');
        downloadButton.style.position = 'fixed';
        downloadButton.style.top = '100px';
        downloadButton.style.right = '20px';
        downloadButton.style.zIndex = '9999';
        downloadButton.style.padding = '10px';
        downloadButton.style.backgroundColor = '#4CAF50';
        downloadButton.style.color = 'white';
        downloadButton.style.border = 'none';
        downloadButton.style.borderRadius = '5px';
        downloadButton.style.cursor = 'pointer';
        downloadButton.style.fontWeight = 'bold';
        
        // 添加按钮到页面
        document.body.appendChild(downloadButton);
        
        // 创建状态显示元素
        const statusDiv = document.createElement('div');
        statusDiv.style.position = 'fixed';
        statusDiv.style.top = '150px';
        statusDiv.style.right = '20px';
        statusDiv.style.zIndex = '9999';
        statusDiv.style.padding = '10px';
        statusDiv.style.border = '1px solid #ddd';
        statusDiv.style.borderRadius = '5px';
        statusDiv.style.display = 'none';
        document.body.appendChild(statusDiv);
        
        // 创建iframe容器
        iframeContainer = document.createElement('div');
        iframeContainer.style.position = 'fixed';
        iframeContainer.style.top = '0';
        iframeContainer.style.left = '0';
        iframeContainer.style.width = '1px';
        iframeContainer.style.height = '1px';
        iframeContainer.style.opacity = '0.01';
        iframeContainer.style.pointerEvents = 'none';
        iframeContainer.style.zIndex = '-1';
        iframeContainer.style.overflow = 'hidden';
        document.body.appendChild(iframeContainer);
        
        // 添加点击事件监听器
        downloadButton.addEventListener('click', async function() {
            if (isDownloading) {
                alert(getText('downloadingAlert'));
                return;
            }
            
            // 获取所有模组ID和信息
            const modInfos = findAllModsInfo();
            
            if (modInfos.length === 0) {
                alert(getText('noModsFound'));
                return;
            }
            
            if (!confirm(getText('confirmDownload', modInfos.length))) {
                return;
            }
            
            // 开始下载过程
            isDownloading = true;
            downloadCount = 0;
            totalCount = modInfos.length;
            
            // 显示状态
            statusDiv.style.display = 'block';
            updateStatus();
            
            // 逐个下载模组
            try {
                for (const modInfo of modInfos) {
                    await downloadModByIframe(modInfo);
                    downloadCount++;
                    updateStatus();
                    // 添加延时以避免被网站识别为机器人
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
                alert(getText('downloadComplete'));
            } catch (error) {
                alert(getText('downloadError', error.message));
                console.error('下载错误:', error);
            } finally {
                isDownloading = false;
                statusDiv.style.display = 'none';
            }
        });
        
        // 更新下载状态显示
        function updateStatus() {
            statusDiv.textContent = getText('progressStatus', downloadCount, totalCount);
        }
    }

    // 通过iframe加载mod页面并点击下载按钮
    async function downloadModByIframe(modInfo) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`开始下载模组: ${modInfo.name} (ID: ${modInfo.id})`);
                currentModInfo = modInfo;
                
                // 清除现有iframe
                iframeContainer.innerHTML = '';
                
                // 创建新iframe
                const iframe = document.createElement('iframe');
                iframe.style.width = '800px';
                iframe.style.height = '600px';
                iframe.style.border = 'none';
                
                // 构建mod页面URL，添加autodownload标识
                const modPageUrl = `${modInfo.modLink}#autodownload`;
                iframe.src = modPageUrl;
                
                // 设置超时处理
                const timeoutId = setTimeout(() => {
                    console.error(`下载模组 ${modInfo.name} 超时`);
                    resolve(); // 即使超时也继续下一个
                }, 30000);
                
                // 监听iframe加载完成事件
                iframe.onload = function() {
                    try {
                        console.log(`模组页面 ${modInfo.name} 加载完成，准备下载`);
                        // 由于跨域限制，我们不能直接访问iframe内容
                        // 我们在iframe页面本身处理下载按钮点击
                        setTimeout(() => {
                            clearTimeout(timeoutId);
                            resolve();
                        }, 5000); // 预留足够时间让iframe内的脚本执行
                    } catch (error) {
                        console.error(`处理iframe加载事件时出错:`, error);
                        clearTimeout(timeoutId);
                        resolve(); // 出错也继续下一个
                    }
                };
                
                // 添加iframe到容器
                iframeContainer.appendChild(iframe);
                
            } catch (error) {
                console.error(`下载模组 ${modInfo.name} (ID: ${modInfo.id}) 时出错:`, error);
                resolve(); // 出错也继续下一个
            }
        });
    }

    // 在mod详情页面自动点击下载按钮
    function clickDownloadButtonOnModPage() {
        try {
            console.log('检测到模组详情页，准备自动点击下载按钮');
            
            // 查找下载按钮并点击
            const downloadButtons = Array.from(document.querySelectorAll('button')).filter(button => {
                const buttonText = button.textContent.trim().toLowerCase();
                // 支持多种语言的下载按钮文本
                return buttonText.includes('download') || 
                       buttonText.includes('下载') || 
                       buttonText.includes('ダウンロード') || 
                       buttonText.includes('herunterladen');
            });
            
            if (downloadButtons.length > 0) {
                console.log('找到下载按钮，点击下载');
                downloadButtons[0].click();
                console.log('下载按钮已点击');
            } else {
                console.error('未找到下载按钮');
            }
        } catch (error) {
            console.error('自动点击下载按钮时出错:', error);
        }
    }

    // 查找页面上所有模组信息
    function findAllModsInfo() {
        const modInfos = [];
        
        // 查找所有模组列表项
        const modItems = document.querySelectorAll('div[class*="Installed-Item-styles__root--"]');
        
        modItems.forEach(modItem => {
            try {
                // 查找模组链接
                const modLink = modItem.querySelector('a[href*="/mods/"]');
                if (modLink) {
                    const href = modLink.getAttribute('href');
                    // 提取模组ID - 格式应该是 /mods/78903/Windows
                    const modIdMatch = href.match(/\/mods\/(\d+)/);
                    if (modIdMatch && modIdMatch[1]) {
                        const modId = modIdMatch[1];
                        const modName = modItem.querySelector('div[class*="displayName--"]')?.textContent || '未知模组';
                        
                        modInfos.push({
                            id: modId,
                            name: modName,
                            modLink: new URL(modLink.getAttribute('href'), window.location.origin).href
                        });
                    }
                }
            } catch (error) {
                console.error('解析模组信息时出错:', error);
            }
        });
        
        return modInfos;
    }
})();