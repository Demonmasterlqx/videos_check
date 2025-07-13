document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoPlayer = document.getElementById('video-player');
    const videoFolderInput = document.getElementById('video-folder-input');
    const taskDescInput = document.getElementById('task-desc-input');
    const csvInput = document.getElementById('csv-input');
    const jumpToFileInput = document.getElementById('jump-to-file-input');
    const jumpBtn = document.getElementById('jump-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playbackRateSlider = document.getElementById('playback-rate-slider');
    const playbackRateValue = document.getElementById('playback-rate-value');
    const classifyBtns = document.querySelectorAll('.classify-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const currentFileNameSpan = document.getElementById('current-file-name');
    const progressCounterSpan = document.getElementById('progress-counter');
    const sceneInfoSpan = document.getElementById('scene-info');
    const captionInfoSpan = document.getElementById('caption-info');

    // State
    let videoFiles = [];
    let currentIndex = -1;
    let classifications = {
        hand: [],
        obj: [],
        ref: [],
        ok: []
    };
    let taskDescriptions = {};

    // --- 1. File and Data Loading ---

    taskDescInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            const rows = content.split('\n').map(row => row.trim()).filter(Boolean);
            if (rows.length < 2) {
                alert('任务描述CSV文件格式不正确，至少需要包含表头和一行数据。');
                return;
            }

            const headers = rows[0].split(',').map(h => h.trim());
            const idIndex = headers.indexOf('id');
            const sceneIndex = headers.indexOf('scene');
            const captionIndex = headers.indexOf('caption');

            if (idIndex === -1 || sceneIndex === -1 || captionIndex === -1) {
                alert('CSV文件必须包含 "id", "scene", 和 "caption" 列。');
                return;
            }
            
            taskDescriptions = {}; // Reset descriptions
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].split(',');
                const id = row[idIndex]?.trim();
                if (id) {
                    taskDescriptions[id] = {
                        scene: row[sceneIndex]?.trim() || '',
                        caption: row[captionIndex]?.trim() || ''
                    };
                }
            }
            alert(`成功加载 ${Object.keys(taskDescriptions).length} 条任务描述。`);
            if (currentIndex !== -1) {
                updateUI(); // Refresh UI if a video is loaded
            }
        } catch (error) {
            console.error(`Error reading task description file ${file.name}:`, error);
            alert(`读取任务描述文件 ${file.name} 失败。`);
        }
    });

    videoFolderInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        videoFiles = files
            .filter(file => file.name.toLowerCase().endsWith('.mp4'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        
        console.log(`Loaded ${videoFiles.length} video files.`);
        alert(`成功加载 ${videoFiles.length} 个 .mp4 文件。`);
        
        if (videoFiles.length > 0) {
            processAndLoadFirstVideo();
        }
    });

    csvInput.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files);
        Object.keys(classifications).forEach(key => { classifications[key] = []; });

        for (const file of files) {
            try {
                const content = await file.text();
                const rows = content.split('\n').map(row => row.trim());
                if (rows.length < 1) continue;

                const headers = rows[0].split(',').map(h => h.trim());
                const dataRows = rows.slice(1);

                dataRows.forEach(row => {
                    const rowItems = row.split(',');
                    rowItems.forEach((item, index) => {
                        const filename = item.trim();
                        if (filename && headers[index]) {
                            const category = headers[index];
                            if (classifications.hasOwnProperty(category) && !classifications[category].includes(filename)) {
                                classifications[category].push(filename);
                            }
                        }
                    });
                });
            } catch (error) {
                console.error(`Error reading CSV file ${file.name}:`, error);
                alert(`读取文件 ${file.name} 失败。`);
            }
        }
        alert('CSV 进度加载完成。');
        if (videoFiles.length > 0) {
            processAndLoadFirstVideo();
        }
    });

    function processAndLoadFirstVideo() {
        const allClassified = new Set(Object.values(classifications).flat());

        let firstUnclassifiedIndex = videoFiles.findIndex(file => !allClassified.has(getFileNameWithoutExtension(file.name)));
        
        if (firstUnclassifiedIndex === -1 && videoFiles.length > 0) {
            // All files are classified, maybe start from beginning or last
            firstUnclassifiedIndex = 0; 
        }
        
        if (firstUnclassifiedIndex >= 0) {
            loadVideo(firstUnclassifiedIndex);
        } else if (videoFiles.length > 0) {
             alert("所有视频都已分类完毕。");
             loadVideo(0); // Or load the first video
        } else {
            // No videos loaded yet, do nothing.
        }
    }


    // --- 2. Video Playback and Controls ---

    function loadVideo(index) {
        if (index >= 0 && index < videoFiles.length) {
            currentIndex = index;
            const file = videoFiles[currentIndex];
            videoPlayer.src = URL.createObjectURL(file);
            videoPlayer.playbackRate = playbackRateSlider.value;
            videoPlayer.play().catch(error => {
                console.warn("Autoplay was prevented:", error);
                // The browser may prevent autoplay if the user hasn't interacted with the page yet.
                // The 'controls' attribute on the video tag allows the user to manually play.
            });
            updateUI();
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (videoPlayer.paused) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            loadVideo(currentIndex - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < videoFiles.length - 1) {
            loadVideo(currentIndex + 1);
        }
    });

    playbackRateSlider.addEventListener('input', () => {
        const rate = parseFloat(playbackRateSlider.value).toFixed(2);
        videoPlayer.playbackRate = rate;
        playbackRateValue.textContent = `${rate}x`;
    });

    jumpBtn.addEventListener('click', () => {
        if (videoFiles.length === 0) {
            alert("请先选择视频文件夹。");
            return;
        }
        const searchName = jumpToFileInput.value.trim();
        if (!searchName) {
            alert("请输入要跳转的文件名。");
            return;
        }

        const searchNameLower = searchName.toLowerCase();
        const foundIndex = videoFiles.findIndex(file => {
            const fileNameLower = file.name.toLowerCase();
            const fileNameWithoutExtLower = getFileNameWithoutExtension(file.name).toLowerCase();
            return fileNameLower === searchNameLower || fileNameWithoutExtLower === searchNameLower;
        });

        if (foundIndex !== -1) {
            loadVideo(foundIndex);
        } else {
            alert(`未在视频列表中找到文件: "${searchName}"`);
        }
    });

    // --- 3. Classification ---

    classifyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentIndex === -1) {
                alert("请先选择视频文件夹。");
                return;
            }
            const newCategory = btn.dataset.category;
            const fileName = getFileNameWithoutExtension(videoFiles[currentIndex].name);
            
            // Remove from any existing category first
            Object.keys(classifications).forEach(cat => {
                const index = classifications[cat].indexOf(fileName);
                if (index > -1) {
                    classifications[cat].splice(index, 1);
                }
            });

            // Add to the new category
            if (!classifications[newCategory].includes(fileName)) {
                classifications[newCategory].push(fileName);
            }
            
            console.log(`Classified '${fileName}' as '${newCategory}'.`);
            updateUI(); // Update button styles immediately

            // Move to next video
            if (currentIndex < videoFiles.length - 1) {
                loadVideo(currentIndex + 1);
            } else {
                alert("已是最后一个视频。");
            }
        });
    });

    // --- 4. CSV Export ---

    exportCsvBtn.addEventListener('click', () => {
        const categories = Object.keys(classifications);
        const header = categories.join(',');
        
        let maxRows = 0;
        categories.forEach(cat => {
            if (classifications[cat].length > maxRows) {
                maxRows = classifications[cat].length;
            }
        });

        if (maxRows === 0) {
            alert("没有可导出的分类数据。");
            return;
        }

        const dataRows = [];
        for (let i = 0; i < maxRows; i++) {
            const row = categories.map(cat => {
                return classifications[cat][i] || ''; // Get filename or empty string
            });
            dataRows.push(row.join(','));
        }

        const csvContent = [header, ...dataRows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'classifications.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // --- 5. UI Updates and Helpers ---

    function updateUI() {
        if (currentIndex !== -1) {
            const currentFile = videoFiles[currentIndex];
            const fileNameWithoutExt = getFileNameWithoutExtension(currentFile.name);
            
            currentFileNameSpan.textContent = currentFile.name;
            progressCounterSpan.textContent = `${currentIndex + 1} / ${videoFiles.length}`;

            const description = taskDescriptions[fileNameWithoutExt];
            if (description) {
                sceneInfoSpan.textContent = description.scene;
                captionInfoSpan.textContent = description.caption;
            } else {
                sceneInfoSpan.textContent = '无';
                captionInfoSpan.textContent = '无';
            }

            // Highlight the button for the current video's category
            let currentCategory = null;
            Object.keys(classifications).forEach(cat => {
                if (classifications[cat].includes(fileNameWithoutExt)) {
                    currentCategory = cat;
                }
            });

            classifyBtns.forEach(btn => {
                if (btn.dataset.category === currentCategory) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

        } else {
            currentFileNameSpan.textContent = '无';
            progressCounterSpan.textContent = `0 / ${videoFiles.length}`;
            sceneInfoSpan.textContent = '无';
            captionInfoSpan.textContent = '无';
            classifyBtns.forEach(btn => btn.classList.remove('active'));
        }
    }

    function getFileNameWithoutExtension(fileName) {
        return fileName.substring(0, fileName.lastIndexOf('.'));
    }
});
