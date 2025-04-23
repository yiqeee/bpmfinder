document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileButton = document.getElementById('file-button');
    const fileName = document.getElementById('file-name');
    const loader = document.getElementById('loader');
    const loaderBar = document.getElementById('loader-bar');
    const loaderPercentage = document.getElementById('loader-percentage');
    const analyzeStatus = document.getElementById('analyze-status');
    const playerContainer = document.getElementById('player-container');
    const audio = document.getElementById('audio');
    const playButton = document.getElementById('play-button');
    const pauseButton = document.getElementById('pause-button');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');
    const trackTitle = document.getElementById('track-title');
    const seekbar = document.getElementById('seekbar');
    const seekbarFill = document.getElementById('seekbar-fill');
    const seekbarThumb = document.getElementById('seekbar-thumb');
    const results = document.getElementById('results');
    const resultBpm = document.getElementById('result-bpm');
    const resultKey = document.getElementById('result-key');

    let audioContext;
    let audioBuffer;
    let isDragging = false;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('highlight');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('highlight');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFile(files);
    });

    fileButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        handleFile(fileInput.files);
    });

    function handleFile(files) {
        if (files.length > 0 && files[0].type.includes('audio')) {
            const file = files[0];
            fileName.textContent = file.name;
            trackTitle.textContent = file.name;

            const objectUrl = URL.createObjectURL(file);
            audio.src = objectUrl;

            results.style.display = 'none';
            playerContainer.style.display = 'none';
            analyzeAudio(file);
        } else {
            alert('Bitte wähle eine gültige Audiodatei aus.');
        }
    }

    async function analyzeAudio(file) {
        loader.style.display = 'block';
        updateProgress(5, 'Datei wird geladen...');

        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const arrayBuffer = await readFileAsArrayBuffer(file);
            updateProgress(20, 'Audio wird dekodiert...');

            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            updateProgress(40, 'Tempo wird analysiert...');

            const bpm = await analyzeBPM(audioBuffer);
            resultBpm.textContent = Math.round(bpm);
            updateProgress(70, 'Tonart wird analysiert...');

            const key = await analyzeKey(audioBuffer);
            resultKey.textContent = key;
            updateProgress(100, 'Analyse abgeschlossen!');

            setTimeout(() => {
                loader.style.display = 'none';
                playerContainer.style.display = 'block';
                results.style.display = 'block';
                setupPlayer();
            }, 500);

        } catch (error) {
            console.error('Fehler bei der Analyse:', error);
            alert('Bei der Analyse ist ein Fehler aufgetreten. Bitte versuche es mit einer anderen Datei.');
            loader.style.display = 'none';
        }
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function updateProgress(percent, status) {
        loaderBar.style.width = `${percent}%`;
        loaderPercentage.textContent = percent;
        analyzeStatus.textContent = status;
    }

    async function analyzeBPM(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Verwende moderne Web Audio API Algorithmen für genauere Ergebnisse
        const frameSize = 1024;
        const hopSize = 512;
        
        // Energie-basierte Tempo-Erkennung
        let energies = [];
        for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < frameSize; j++) {
                energy += Math.abs(channelData[i + j]);
            }
            energies.push(energy / frameSize);
        }
        
        // Finde Peaks im Energiesignal
        const threshold = 1.5 * (energies.reduce((a, b) => a + b, 0) / energies.length);
        let peaks = [];
        
        for (let i = 2; i < energies.length - 2; i++) {
            if (energies[i] > threshold && 
                energies[i] > energies[i-1] && 
                energies[i] > energies[i-2] &&
                energies[i] > energies[i+1] && 
                energies[i] > energies[i+2]) {
                peaks.push(i);
            }
        }
        
        // Berechne Intervalle zwischen Peaks
        let intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i-1]);
        }
        
        // Cluster ähnliche Intervalle
        let intervalGroups = {};
        intervals.forEach(interval => {
            // Runde auf nächste 5
            const roundedInterval = Math.round(interval / 5) * 5;
            
            if (!intervalGroups[roundedInterval]) {
                intervalGroups[roundedInterval] = 0;
            }
            intervalGroups[roundedInterval]++;
        });
        
        // Finde das häufigste Intervall
        let maxCount = 0;
        let mostFrequentInterval = 0;
        
        for (const interval in intervalGroups) {
            if (intervalGroups[interval] > maxCount) {
                maxCount = intervalGroups[interval];
                mostFrequentInterval = parseInt(interval);
            }
        }
        
        // Berechne BPM aus dem häufigsten Intervall
        const secondsPerFrame = hopSize / sampleRate;
        const intervalInSeconds = mostFrequentInterval * secondsPerFrame;
        let bpm = 60 / intervalInSeconds;
        
        // Normalisiere auf typischen BPM-Bereich
        while (bpm > 180) bpm /= 2;
        while (bpm < 60) bpm *= 2;
        
        return bpm;
    }

    async function analyzeKey(audioBuffer) {
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        
        // Chromagram erstellen (12 Noten)
        const noteStrengths = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Einfache FFT-basierte Analyse
        const fftSize = 4096;
        const fft = new Float32Array(fftSize);
        
        // Verarbeite das Signal in Blöcken
        const blockSize = 16384;
        const numBlocks = Math.floor(channelData.length / blockSize);
        
        for (let block = 0; block < numBlocks; block++) {
            const start = block * blockSize;
            
            // Fensterfunktion anwenden und FFT füllen
            for (let i = 0; i < fftSize && i + start < channelData.length; i++) {
                // Hanning-Fenster
                const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
                fft[i] = channelData[start + i] * window;
            }
            
            // Einfache DFT für Frequenzanalyse
            for (let bin = 0; bin < 512; bin++) {
                const freq = bin * sampleRate / fftSize;
                
                // Ignore extremely low and high frequencies
                if (freq > 60 && freq < 5000) {
                    // Konvertiere Frequenz in Notenwert
                    const noteIndex = Math.round(12 * Math.log2(freq / 440) + 69) % 12;
                    
                    // Magnitude der Frequenz berechnen
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
        
        // Finde den stärksten Grundton
        let maxStrength = 0;
        let rootNote = 0;
        
        for (let i = 0; i < 12; i++) {
            if (noteStrengths[i] > maxStrength) {
                maxStrength = noteStrengths[i];
                rootNote = i;
            }
        }
        
        // Dur/Moll-Erkennung - Vergleiche Dur- und Moll-Muster
        const majorThird = (rootNote + 4) % 12;
        const minorThird = (rootNote + 3) % 12;
        
        const isMajor = noteStrengths[majorThird] > noteStrengths[minorThird];
        
        return `${noteNames[rootNote]} ${isMajor ? 'Dur' : 'Moll'}`;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    function setupPlayer() {
        totalTime.textContent = formatTime(audio.duration);
        currentTime.textContent = '0:00';

        playButton.addEventListener('click', () => {
            audio.play();
            playButton.classList.add('hidden');
            pauseButton.classList.remove('hidden');
        });

        pauseButton.addEventListener('click', () => {
            audio.pause();
            pauseButton.classList.add('hidden');
            playButton.classList.remove('hidden');
        });

        audio.addEventListener('timeupdate', () => {
            if (!isDragging) {
                const percent = (audio.currentTime / audio.duration) * 100;
                seekbarFill.style.width = `${percent}%`;
                seekbarThumb.style.left = `${percent}%`;
                currentTime.textContent = formatTime(audio.currentTime);
            }
        });

        audio.addEventListener('ended', () => {
            pauseButton.classList.add('hidden');
            playButton.classList.remove('hidden');
            seekbarFill.style.width = '0%';
            seekbarThumb.style.left = '0%';
            currentTime.textContent = '0:00';
        });

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
                const percent = parseFloat(seekbarThumb.style.left) / 100;
                audio.currentTime = percent * audio.duration;
            }
        });

        seekbar.addEventListener('click', (e) => {
            updateSeekPosition(e);
            const percent = parseFloat(seekbarThumb.style.left) / 100;
            audio.currentTime = percent * audio.duration;
        });
    }

    function updateSeekPosition(e) {
        const rect = seekbar.getBoundingClientRect();
        let position = (e.clientX - rect.left) / rect.width;
        
        position = Math.max(0, Math.min(position, 1));
        
        const percent = position * 100;
        seekbarFill.style.width = `${percent}%`;
        seekbarThumb.style.left = `${percent}%`;
    }
});