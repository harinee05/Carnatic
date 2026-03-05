// pitchWorklet.js - AudioWorklet for real-time pitch detection
// Implements YIN algorithm for fundamental frequency estimation

class PitchProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // YIN algorithm parameters
        this.sampleRate = 44100;
        this.yinThreshold = 0.15;
        this.minFreq = 80;
        this.maxFreq = 1000;
        
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        this.isReady = false;
        
        // Minimum period for maxFreq
        this.minPeriod = Math.floor(this.sampleRate / this.maxFreq);
        // Maximum period for minFreq  
        this.maxPeriod = Math.floor(this.sampleRate / this.minFreq);
        
        this.startTime = Date.now();
        
        // Listen for messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'setStartTime') {
                this.startTime = event.data.time;
            }
        };
    }

    // YIN pitch detection algorithm
    detectPitch(audioBuffer) {
        const halfLen = Math.floor(audioBuffer.length / 2);
        
        // Check if signal is too quiet (silence detection)
        let rms = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            rms += audioBuffer[i] * audioBuffer[i];
        }
        rms = Math.sqrt(rms / audioBuffer.length);
        if (rms < 0.01) {
            return { frequency: -1, confidence: 0 };
        }

        // Step 1: Difference function
        const diff = new Float32Array(halfLen);
        for (let tau = 0; tau < halfLen; tau++) {
            let sum = 0;
            for (let i = 0; i < halfLen; i++) {
                const d = audioBuffer[i] - audioBuffer[i + tau];
                sum += d * d;
            }
            diff[tau] = sum;
        }

        // Step 2: Cumulative mean normalized difference
        const cmnd = new Float32Array(halfLen);
        cmnd[0] = 1;
        let runningSum = 0;
        for (let tau = 1; tau < halfLen; tau++) {
            runningSum += diff[tau];
            cmnd[tau] = diff[tau] * tau / runningSum;
        }

        // Step 3: Absolute threshold
        let tauEstimate = -1;
        const searchStart = this.minPeriod;
        const searchEnd = Math.min(this.maxPeriod, halfLen - 1);
        
        for (let tau = searchStart; tau < searchEnd; tau++) {
            if (cmnd[tau] < this.yinThreshold) {
                while (tau + 1 < halfLen && cmnd[tau + 1] < cmnd[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) {
            return { frequency: -1, confidence: 0 };
        }

        // Step 4: Parabolic interpolation for sub-sample accuracy
        let betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < halfLen - 1) {
            const s0 = cmnd[tauEstimate - 1];
            const s1 = cmnd[tauEstimate];
            const s2 = cmnd[tauEstimate + 1];
            const denom = 2 * (2 * s1 - s2 - s0);
            if (Math.abs(denom) > 1e-10) {
                betterTau = tauEstimate + (s2 - s0) / denom;
            }
        }

        const frequency = this.sampleRate / betterTau;
        const confidence = Math.max(0, Math.min(1, 1.0 - cmnd[tauEstimate]));

        return { frequency, confidence };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        if (input && input.length > 0) {
            const channelData = input[0];
            
            // Fill our buffer
            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex] = channelData[i];
                this.bufferIndex++;
                
                // When buffer is full, process it
                if (this.bufferIndex >= this.bufferSize) {
                    this.bufferIndex = 0;
                    
                    const result = this.detectPitch(this.buffer);
                    const timeMs = Date.now() - this.startTime;
                    
                    // Send result back to main thread
                    this.port.postMessage({
                        type: 'pitchResult',
                        timeMs: timeMs,
                        frequency: result.frequency,
                        confidence: result.confidence
                    });
                }
            }
        }

        return true; // Keep processor alive
    }
}

// Register the processor
registerProcessor('pitch-processor', PitchProcessor);
