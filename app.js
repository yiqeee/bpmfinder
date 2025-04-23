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