// SoundMaster - BPM & Key Analyzer
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileName = document.getElementById('file-name');
    const loaderSection = document.getElementById('loader-section');
    const progressBar = document.getElementById('progress-bar');
    const analyzeStatus = document.getElementById('analyze-status');
    const percentValue = document.getElementById('percent-value');
    const playerSection = document.getElementById('player-section');
    const audioPlayer = document.getElementById('audio-player');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const trackTitle = document.getElementById('track-title');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');
    const seekbar = document.getElementById('seekbar');
    const seekbarProgress = document.getElementById('seekbar-progress');
    const seekbarThumb = document.getElementById('seekbar-thumb');
    const resultsSection = document.getElementById('results-section');
    const bpmValue = document.getElementById('bpm-value');
    const keyValue = document.getElementById('key-value');
    const compatibleKeys = document.getElementById('compatible-keys');

    // Variables
    let audioContext;
    let audioBuffer;
    let isDragging = false;

    // Event Listeners
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('highlight');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('highlight');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        handleFiles(e.dataTransfer.files);
    });

    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    // Handle file upload
    function handleFiles(files) {
        if (files.length > 0 && files[0].type.includes('audio')) {
            const file = files[0];
            fileName.textContent = file.name;
            trackTitle.textContent = file.name;

            // Reset UI
            playerSection.classList.add('hidden');
            resultsSection.classList.add('hidden');

            // Set source for audio player
            const objectUrl = URL.createObjectURL(file);
            audioPlayer.src = objectUrl;

            // Start analysis
            startAnalysis(file);
        } else {
            alert('Bitte wähle eine gültige Audiodatei aus (MP3, WAV, etc.).');
        }
    }

    // Start audio analysis
    async function startAnalysis(file) {
        loaderSection.classList.remove('hidden');
        updateProgress(5, 'Audiodatei wird vorbereitet...');

        try {
            // Initialize AudioContext if not already done
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Read file as array buffer
            const arrayBuffer = await readFileAsArrayBuffer(file);
            updateProgress(20, 'Dekodiere Audio...');

            // Decode audio data
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            updateProgress(35, 'Analysiere Tempo (BPM)...');

            // Analyze BPM
            const bpm = await analyzeBPM(audioBuffer);
            bpmValue.textContent = Math.round(bpm);
            updateProgress(70, 'Analysiere Tonart (Key)...');

            // Analyze Key
            const key = await analyzeKey(audioBuffer);
            keyValue.textContent = key;
            updateProgress(90, 'Berechne kompatible Tonarten...');

            // Get compatible keys
            const compatibleKeysList = getCompatibleKeys(key);
            compatibleKeys.textContent = compatibleKeysList;
            updateProgress(100, 'Analyse abgeschlossen!');

            // Show results after a slight delay
            setTimeout(() => {
                loaderSection.classList.add('hidden');
                playerSection.classList.remove('hidden');
                resultsSection.classList.remove('hidden');
                setupPlayer();
            }, 800);

        } catch (error) {
            console.error('Analysis error:', error);
            alert('Bei der Analyse ist ein Fehler aufgetreten. Bitte versuche es mit einer anderen Datei.');
            loaderSection.classList.add('hidden');
        }
    }

    // Helper Functions
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function updateProgress(percent, statusText) {
        progressBar.style.width = `${percent}%`;
        percentValue.textContent = percent;
        analyzeStatus.textContent = statusText;
    }

    async function analyzeBPM(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Verwende einen längeren Abschnitt für bessere Ergebnisse
        // Extrahiere 30 Sekunden aus der Mitte, falls möglich
        const startSample = Math.floor(channelData.length / 4);
        const endSample = Math.min(startSample + sampleRate * 30, channelData.length);
        const sampleLength = endSample - startSample;
        
        // Verwende einen größeren Frame für bessere Tieffrequenz-Erkennung
        const frameSize = 2048;
        const hopSize = 512;
        
        // Energy-based onset detection with low-pass filter (fokussiert auf Bassdrum)
        let energies = [];
        for (let i = startSample; i < endSample - frameSize; i += hopSize) {
            // Low-pass Filter-Simulation durch Berechnung vorwiegend tieffrequenter Energie
            let lowEnergy = 0;
            let totalSamples = 0;
            
            for (let j = 0; j < frameSize; j += 8) { // Unterabtastung für Tiefpasseffekt
                lowEnergy += Math.abs(channelData[i + j]);
                totalSamples++;
            }
            
            energies.push(lowEnergy / totalSamples);
        }
        
        // Normalisiere Energiewerte
        const maxEnergy = Math.max(...energies);
        energies = energies.map(e => e / maxEnergy);
        
        // Adaptive Threshold für bessere Peak-Erkennung
        const mean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
        const variance = energies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / energies.length;
        const threshold = mean + 0.8 * Math.sqrt(variance); // Dynamische Schwelle basierend auf Varianz
        
        // Find peaks (Onset-Erkennung)
        let peaks = [];
        for (let i = 3; i < energies.length - 3; i++) {
            if (energies[i] > threshold && 
                energies[i] > energies[i-1] && 
                energies[i] > energies[i-2] && 
                energies[i] > energies[i-3] &&
                energies[i] > energies[i+1] && 
                energies[i] > energies[i+2] &&
                energies[i] > energies[i+3]) {
                peaks.push(i);
            }
        }
        
        // Berechne Intervalle zwischen Peaks
        let intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i-1]);
        }
        
        if (intervals.length === 0) {
            // Fallback, wenn keine klaren Peaks erkannt werden
            return 120; // Standardwert
        }
        
        // Histogram-basierte Analyse für robustere BPM-Erkennung
        const histogramBins = {};
        const tolerance = 0.05; // 5% Toleranz
        
        intervals.forEach(interval => {
            // Gruppiere ähnliche Intervalle
            let matchFound = false;
            
            for (const key in histogramBins) {
                const binInterval = parseFloat(key);
                // Prüfe, ob das Intervall in die Toleranz eines bestehenden Bins fällt
                if (Math.abs(interval - binInterval) / binInterval < tolerance) {
                    histogramBins[key]++;
                    matchFound = true;
                    break;
                }
            }
            
            if (!matchFound) {
                histogramBins[interval] = 1;
            }
        });
        
        // Finde das häufigste Intervall
        let maxCount = 0;
        let mostCommonInterval = 0;
        
        for (const interval in histogramBins) {
            if (histogramBins[interval] > maxCount) {
                maxCount = histogramBins[interval];
                mostCommonInterval = parseFloat(interval);
            }
        }
        
        // Konvertiere Intervall zu BPM
        const secondsPerFrame = hopSize / sampleRate;
        const intervalInSeconds = mostCommonInterval * secondsPerFrame;
        let bpm = 60 / intervalInSeconds;
        
        // Prüfe verschiedene mögliche BPM-Multiplikatoren (typische Fehlerquellen)
        const possibleBPMs = [
            bpm / 2, // Halbes Tempo
            bpm, // Erkanntes Tempo
            bpm * 2, // Doppeltes Tempo
            bpm / 3, // Ein Drittel
            bpm * 3/2, // Punktierter Rhythmus
            bpm * 3/4  // Triolenrhythmus
        ];
        
        // Behalte nur BPMs im typischen Bereich (70-150 ist üblich für die meisten Musikstile)
        const validBPMs = possibleBPMs.filter(tempo => tempo >= 70 && tempo <= 150);
        
        // Wenn ein valider BPM im typischen Bereich ist, verwende diesen
        if (validBPMs.length > 0) {
            // Wähle den BPM, der am nächsten an 120 BPM liegt (typisches Durchschnittstempo)
            return validBPMs.reduce((prev, curr) => 
                Math.abs(curr - 120) < Math.abs(prev - 120) ? curr : prev
            );
        }
        
        // Bei Werten über 160, halbiere
        if (bpm > 160) return bpm / 2;
        // Bei Werten unter 70, verdopple
        if (bpm < 70) return bpm * 2;
        
        return bpm;
    }

    async function analyzeKey(audioBuffer) {
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        
        // Chromagram calculation (12 notes)
        const noteStrengths = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // FFT-based analysis
        const fftSize = 4096;
        const fft = new Float32Array(fftSize);
        
        // Process signal in blocks
        const blockSize = 16384;
        const numBlocks = Math.floor(channelData.length / blockSize);
        
        for (let block = 0; block < numBlocks; block++) {
            const start = block * blockSize;
            
            // Apply window function and fill FFT buffer
            for (let i = 0; i < fftSize && i + start < channelData.length; i++) {
                // Hanning window
                const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
                fft[i] = channelData[start + i] * window;
            }
            
            // Simplified DFT for frequency analysis
            for (let bin = 0; bin < 512; bin++) {
                const freq = bin * sampleRate / fftSize;
                
                // Focus on relevant frequencies for music
                if (freq > 60 && freq < 5000) {
                    // Convert frequency to note index
                    const noteIndex = Math.round(12 * Math.log2(freq / 440) + 69) % 12;
                    
                    // Calculate magnitude
                    let real = 0;
                    let imag = 0;
                    
                    for (let i = 0; i < fftSize; i++) {
                        const phase = 2 * Math.PI * bin * i / fftSize;
                        real += fft[i] * Math.cos(phase);
                        imag -= fft[i] * Math.sin(phase);
                    }
                    
                    const magnitude = Math.sqrt(real * real + imag * imag);
                    noteStrengths[noteIndex] += magnitude;
                }
            }
        }
        
        // Find the strongest note (root)
        let maxStrength = 0;
        let rootNote = 0;
        
        for (let i = 0; i < 12; i++) {
            if (noteStrengths[i] > maxStrength) {
                maxStrength = noteStrengths[i];
                rootNote = i;
            }
        }
        
        // Major/minor determination
        const majorThird = (rootNote + 4) % 12;
        const minorThird = (rootNote + 3) % 12;
        
        const isMajor = noteStrengths[majorThird] > noteStrengths[minorThird];
        
        return `${noteNames[rootNote]} ${isMajor ? 'Dur' : 'Moll'}`;
    }

    function getCompatibleKeys(key) {
        // Parse the key
        const [note, mode] = key.split(' ');
        const isMajor = mode === 'Dur';
        
        const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Find the index of the current note
        const noteIndex = allNotes.indexOf(note);
        
        // Calculate compatible keys
        let compatibleIndices = [];
        
        if (isMajor) {
            // Relative minor
            compatibleIndices.push((noteIndex + 9) % 12);
            // Perfect 4th up
            compatibleIndices.push((noteIndex + 5) % 12);
            // Perfect 5th up
            compatibleIndices.push((noteIndex + 7) % 12);
        } else {
            // Relative major
            compatibleIndices.push((noteIndex + 3) % 12);
            // Perfect 4th up
            compatibleIndices.push((noteIndex + 5) % 12);
            // Perfect 5th up
            compatibleIndices.push((noteIndex + 7) % 12);
        }
        
        // Create string of compatible keys
        let compatibleKeys = compatibleIndices.map(index => {
            const newNote = allNotes[index];
            const newMode = index === ((noteIndex + 3) % 12) && !isMajor ? 'Dur' : 
                            index === ((noteIndex + 9) % 12) && isMajor ? 'Moll' : mode;
            return `${newNote} ${newMode}`;
        });
        
        return compatibleKeys.join(', ');
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function setupPlayer() {
        // Update total time display
        audioPlayer.addEventListener('loadedmetadata', () => {
            totalTime.textContent = formatTime(audioPlayer.duration);
            currentTime.textContent = '0:00';
        });
        
        // Set up play/pause functionality
        playBtn.addEventListener('click', () => {
            audioPlayer.play();
            playBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
        });
        
        pauseBtn.addEventListener('click', () => {
            audioPlayer.pause();
            pauseBtn.classList.add('hidden');
            playBtn.classList.remove('hidden');
        });
        
        // Update time and seekbar
        audioPlayer.addEventListener('timeupdate', () => {
            if (!isDragging) {
                const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                seekbarProgress.style.width = `${percent}%`;
                seekbarThumb.style.left = `${percent}%`;
                currentTime.textContent = formatTime(audioPlayer.currentTime);
            }
        });
        
        // Handle seekbar interaction
        seekbar.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSeekPosition(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateSeekPosition(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                const percentAsDecimal = parseFloat(seekbarThumb.style.left) / 100;
                audioPlayer.currentTime = percentAsDecimal * audioPlayer.duration;
            }
        });
        
        // Handle direct clicks on seekbar
        seekbar.addEventListener('click', (e) => {
            updateSeekPosition(e);
            const percentAsDecimal = parseFloat(seekbarThumb.style.left) / 100;
            audioPlayer.currentTime = percentAsDecimal * audioPlayer.duration;
        });
        
        // Reset player when finished
        audioPlayer.addEventListener('ended', () => {
            pauseBtn.classList.add('hidden');
            playBtn.classList.remove('hidden');
            seekbarProgress.style.width = '0%';
            seekbarThumb.style.left = '0%';
            currentTime.textContent = '0:00';
        });
    }

    function updateSeekPosition(e) {
        const rect = seekbar.getBoundingClientRect();
        let position = (e.clientX - rect.left) / rect.width;
        
        // Clamp between 0 and 1
        position = Math.max(0, Math.min(position, 1));
        
        const percent = position * 100;
        seekbarProgress.style.width = `${percent}%`;
        seekbarThumb.style.left = `${percent}%`;
    }
});