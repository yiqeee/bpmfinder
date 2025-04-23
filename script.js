document.addEventListener('DOMContentLoaded', function() {
    // DOM-Elemente
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const fileInfo = document.getElementById('fileInfo');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    const analyzeStepText = document.getElementById('analyzeStepText');
    const audioControls = document.getElementById('audioControls');
    const audioPlayer = document.getElementById('audioPlayer');
    const results = document.getElementById('results');
    const fileName = document.getElementById('fileName');
    const bpmResult = document.getElementById('bpmResult');
    const keyResult = document.getElementById('keyResult');
    const trackName = document.getElementById('trackName');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const currentTime = document.getElementById('currentTime');
    const totalTime = document.getElementById('totalTime');
    const seekBar = document.getElementById('seekBar');
    const seekProgress = document.getElementById('seekProgress');
    const seekHandle = document.getElementById('seekHandle');
    
    // Variablen
    let audioContext;
    let audioBuffer;
    let dragging = false;
    
    // Event Listeners für Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    // Datei-Upload-Funktionen
    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);
    browseBtn.addEventListener('click', () => fileInput.click());
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0 && files[0].type.startsWith('audio/')) {
            handleFiles(files);
        } else {
            showNotification('Bitte lade eine Audiodatei hoch (MP3, WAV, etc.)', 'error');
        }
    }
    
    function handleFileSelect(e) {
        const files = e.target.files;
        
        if (files.length > 0 && files[0].type.startsWith('audio/')) {
            handleFiles(files);
        } else {
            showNotification('Bitte lade eine Audiodatei hoch (MP3, WAV, etc.)', 'error');
        }
    }
    
    function handleFiles(files) {
        const file = files[0];
        fileInfo.textContent = `Ausgewählte Datei: ${file.name}`;
        fileName.textContent = file.name;
        trackName.textContent = file.name;
        
        // Audio-Player aktualisieren
        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        audioControls.style.display = 'none';
        results.style.display = 'none';
        
        // Analyse starten
        analyzeAudio(file);
    }
    
    // Audio-Analyse-Funktionen
    async function analyzeAudio(file) {
        progressContainer.style.display = 'block';
        updateProgress(0, 'Initialisiere Analyse...');
        
        try {
            // AudioContext erstellen falls noch nicht vorhanden
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Audio-Datei lesen
            const arrayBuffer = await readFileAsArrayBuffer(file);
            updateProgress(20, 'Audio-Datei geladen');
            
            // Audio decodieren
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            updateProgress(40, 'Audio dekodiert');
            
            // BPM erkennen
            const bpm = await detectBPM(audioBuffer);
            bpmResult.textContent = `${Math.round(bpm)}`;
            updateProgress(70, 'BPM erkannt');
            
            // Key erkennen
            const key = await detectKey(audioBuffer);
            keyResult.textContent = key;
            updateProgress(90, 'Key erkannt');
            
            // Player Setup
            setupAudioPlayer();
            updateProgress(100, 'Analyse abgeschlossen');
            
            // Ergebnisse anzeigen
            setTimeout(() => {
                progressContainer.style.display = 'none';
                audioControls.style.display = 'block';
                results.style.display = 'block';
                
                // Ergebnis Animationen
                animateResultValues();
            }, 500);
            
        } catch (error) {
            console.error('Fehler bei der Analyse:', error);
            showNotification('Bei der Analyse ist ein Fehler aufgetreten. Bitte versuche es mit einer anderen Datei.', 'error');
            progressContainer.style.display = 'none';
        }
    }
    
    // Helper-Funktionen
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    function updateProgress(percent, stepText) {
        progressBar.style.width = `${percent}%`;
        progressPercentage.textContent = `${percent}%`;
        analyzeStepText.textContent = stepText;
    }
    
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    function showNotification(message, type = 'info') {
        // In einer echten Anwendung würde hier eine schöne Benachrichtigung angezeigt werden
        alert(message);
    }
    
    function animateResultValues() {
        // BPM Wert animieren
        const bpmValue = parseInt(bpmResult.textContent);
        if (!isNaN(bpmValue)) {
            let count = 0;
            const interval = setInterval(() => {
                count += Math.ceil(bpmValue / 50);
                if (count >= bpmValue) {
                    clearInterval(interval);
                    bpmResult.textContent = bpmValue;
                } else {
                    bpmResult.textContent = count;
                }
            }, 20);
        }
    }
    
    // Audio Player Funktionen
    function setupAudioPlayer() {
        // Aktualisiere die Gesamtzeit
        audioPlayer.addEventListener('loadedmetadata', function() {
            totalTime.textContent = formatTime(audioPlayer.duration);
            currentTime.textContent = '0:00';
        });
        
        // Play/Pause Buttons
        playBtn.addEventListener('click', function() {
            audioPlayer.play();
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'flex';
        });
        
        pauseBtn.addEventListener('click', function() {
            audioPlayer.pause();
            pauseBtn.style.display = 'none';
            playBtn.style.display = 'flex';
        });
        
        // Timeupdate für den Progress Bar
        audioPlayer.addEventListener('timeupdate', function() {
            if (!dragging) {
                const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                seekProgress.style.width = `${percent}%`;
                seekHandle.style.left = `${percent}%`;
                currentTime.textContent = formatTime(audioPlayer.currentTime);
            }
        });
        
        // Seekbar Interaktion
        seekBar.addEventListener('mousedown', function(e) {
            dragging = true;
            updateSeekBar(e);
        });
        
        document.addEventListener('mousemove', function(e) {
            if (dragging) {
                updateSeekBar(e);
            }
        });
        
        document.addEventListener('mouseup', function() {
            if (dragging) {
                dragging = false;
                audioPlayer.currentTime = (parseFloat(seekHandle.style.left) / 100) * audioPlayer.duration;
            }
        });
        
        // Ende der Wiedergabe
        audioPlayer.addEventListener('ended', function() {
            pauseBtn.style.display = 'none';
            playBtn.style.display = 'flex';
            seekProgress.style.width = '0%';
            seekHandle.style.left = '0%';
            currentTime.textContent = '0:00';
        });
    }
    
    function updateSeekBar(e) {
        const seekBarRect = seekBar.getBoundingClientRect();
        let positionX = e.clientX - seekBarRect.left;
        
        // Begrenzung auf die Seekbar-Grenzen
        if (positionX < 0) positionX = 0;
        if (positionX > seekBarRect.width) positionX = seekBarRect.width;
        
        const percent = (positionX / seekBarRect.width) * 100;
        seekProgress.style.width = `${percent}%`;
        seekHandle.style.left = `${percent}%`;
        
        // Aktualisiere die angezeigte Zeit