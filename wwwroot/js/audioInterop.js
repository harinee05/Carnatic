/* ============================================================
   audioInterop.js — Browser audio capture, pitch detection,
   and real-time visualization for Carnatic Raga Trainer
   ============================================================ */

window.AudioInterop = {
    audioContext: null,
    mediaStream: null,
    processorNode: null,
    isRecording: false,
    dotNetRef: null,
    canvas: null,
    canvasCtx: null,
    animFrameId: null,

    // Reference playback
    referenceCtx: null,
    referenceOscillators: [],

    // Shruti drone (Real Tanpura Buffer)
    shrutiCtx: null,
    shrutiGainNode: null,
    tanpuraBuffer: null,
    tanpuraSource: null,

    // Metronome
    metronomeCtx: null,
    metronomeIntervalId: null,
    metronomeBeatTime: 0,

    // Pitch data for visualization
    pitchHistory: [],
    referencePitchHistory: [],
    swaraLines: [],
    maxVisibleTimeMs: 10000,
    startTime: 0,

    // AudioWorklet
    audioWorkletNode: null,
    workletReady: false,

    // YIN pitch detection config
    sampleRate: 44100,
    yinThreshold: 0.15,
    minFreq: 80,
    maxFreq: 1000,

    // Colors
    colors: {
        bg: '#0f0f1a',
        grid: 'rgba(255,255,255,0.06)',
        swaraLine: 'rgba(255,183,77,0.4)',
        swaraLabel: '#ffb74d',
        pitchGood: '#00e676',
        pitchWarn: '#ffd740',
        pitchBad: '#ff5252',
        reference: 'rgba(100,181,246,0.5)',
        mistakeBlip: '#ff5252',
        timeline: 'rgba(255,255,255,0.15)',
    },

    /** Initialize the audio context and connect to the canvas */
    initialize: function (dotNetRef, canvasId) {
        console.log('[AudioInterop] Initialize called with canvasId:', canvasId);
        this.dotNetRef = dotNetRef;
        this.canvas = document.getElementById(canvasId);
        if (this.canvas) {
            console.log('[AudioInterop] Canvas found, getting context...');
            this.canvasCtx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.drawIdleState();
            console.log('[AudioInterop] Initialization complete');
        } else {
            console.error('[AudioInterop] Canvas NOT FOUND with id:', canvasId);
        }
    },

    resizeCanvas: function () {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight || 400;
    },

    /* ---- YIN Pitch Detection (runs in JS to avoid SignalR overhead) ---- */

    detectPitch: function (audioBuffer) {
        const bufLen = audioBuffer.length;
        const halfLen = Math.floor(bufLen / 2);
        const minPeriod = Math.floor(this.sampleRate / this.maxFreq);
        const maxPeriod = Math.min(Math.floor(this.sampleRate / this.minFreq), halfLen - 1);

        if (halfLen < maxPeriod + 1) {
            return { frequency: -1, confidence: 0 };
        }

        // Check if signal is too quiet (silence detection)
        let rms = 0;
        for (let i = 0; i < bufLen; i++) {
            rms += audioBuffer[i] * audioBuffer[i];
        }
        rms = Math.sqrt(rms / bufLen);
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
        for (let tau = minPeriod; tau < maxPeriod; tau++) {
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

        // Step 4: Parabolic interpolation
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
    },

    /* ---- Swara mapping (runs in JS) ---- */

    saFrequencyHz: 130.81,
    ragaSwaraOffsets: [], // [{name, semitone}]

    setSaFrequency: function (freqHz) {
        this.saFrequencyHz = freqHz;
    },

    setRagaSwaras: function (swaraInfos) {
        // swaraInfos: [{name: "Sa", semitone: 0}, {name: "Ri₁", semitone: 1}, ...]
        this.ragaSwaraOffsets = swaraInfos;
    },

    findNearestSwara: function (freqHz) {
        if (freqHz <= 0 || this.saFrequencyHz <= 0 || this.ragaSwaraOffsets.length === 0) {
            return { name: '', centDeviation: 0, isInRaga: true };
        }

        const totalSemitones = 12 * Math.log2(freqHz / this.saFrequencyHz);
        const octaveOffset = Math.floor(totalSemitones / 12);
        let semitonesInOctave = totalSemitones - (octaveOffset * 12);
        if (semitonesInOctave < 0) semitonesInOctave += 12;

        let nearest = this.ragaSwaraOffsets[0];
        let minCentDev = Infinity;

        // Check all 12 chromatic positions
        const allPositions = [
            { name: 'Sa', semitone: 0 }, { name: 'Ri₁', semitone: 1 },
            { name: 'Ri₂', semitone: 2 }, { name: 'Ri₃', semitone: 3 },
            { name: 'Ga₃', semitone: 4 }, { name: 'Ma₁', semitone: 5 },
            { name: 'Ma₂', semitone: 6 }, { name: 'Pa', semitone: 7 },
            { name: 'Da₁', semitone: 8 }, { name: 'Da₂', semitone: 9 },
            { name: 'Da₃', semitone: 10 }, { name: 'Ni₃', semitone: 11 },
        ];

        for (const pos of allPositions) {
            let centDev = (semitonesInOctave - pos.semitone) * 100;
            if (Math.abs(centDev) > 600) {
                centDev = centDev > 0 ? centDev - 1200 : centDev + 1200;
            }
            if (Math.abs(centDev) < Math.abs(minCentDev)) {
                minCentDev = centDev;
                nearest = pos;
            }
        }

        // Check if this swara is in the raga
        const isInRaga = this.ragaSwaraOffsets.some(s => s.semitone === nearest.semitone)
            && Math.abs(minCentDev) <= 50;

        // Use raga swara name if available
        const ragaSwara = this.ragaSwaraOffsets.find(s => s.semitone === nearest.semitone);
        const name = ragaSwara ? ragaSwara.name : nearest.name;

        return { name, centDeviation: minCentDev, isInRaga };
    },

    /** Start recording from microphone using AudioWorklet */
    startRecording: async function () {
        try {
            console.log('[AudioInterop] Starting recording with AudioWorklet...');

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Load the AudioWorklet
            try {
                await this.audioContext.audioWorklet.addModule('js/pitchWorklet.js');
                console.log('[AudioInterop] AudioWorklet loaded successfully');
            } catch (workletError) {
                console.error('[AudioInterop] Failed to load worklet:', workletError);
                throw new Error('AudioWorklet not supported');
            }

            // Create the AudioWorkletNode
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pitch-processor');

            // Handle messages from the worklet
            this.audioWorkletNode.port.onmessage = (event) => {
                if (event.data.type === 'pitchResult') {
                    this.handlePitchResult(event.data);
                }
            };

            this.pitchHistory = [];
            this.startTime = Date.now();
            this.isRecording = true;

            // Send start time to worklet
            this.audioWorkletNode.port.postMessage({
                type: 'setStartTime',
                time: this.startTime
            });

            source.connect(this.audioWorkletNode);
            this.audioWorkletNode.connect(this.audioContext.destination);

            this.startVisualization();
            console.log('[AudioInterop] Recording started successfully');
            return true;
        } catch (error) {
            console.error('[AudioInterop] Failed to start recording:', error);
            return false;
        }
    },

    /** Handle pitch result from AudioWorklet */
    handlePitchResult: function (data) {
        if (!this.isRecording) return;

        const { timeMs, frequency, confidence } = data;

        if (frequency > 0 && confidence > 0.5) {
            const swaraResult = this.findNearestSwara(frequency);

            this.pitchHistory.push({
                timeMs,
                frequencyHz: frequency,
                centDeviation: swaraResult.centDeviation,
                isInRaga: swaraResult.isInRaga,
                swaraName: swaraResult.name,
                confidence: confidence
            });

            // Send only the small analyzed result to .NET (for stats)
            if (this.dotNetRef && this.pitchHistory.length % 5 === 0) {
                this.dotNetRef.invokeMethodAsync('OnPitchResult',
                    timeMs,
                    frequency,
                    swaraResult.centDeviation,
                    swaraResult.isInRaga,
                    swaraResult.name
                ).catch(() => { /* circuit may be disconnected */ });
            }
        } else {
            // Silence — still log for timeline continuity
            this.pitchHistory.push({
                timeMs,
                frequencyHz: 0,
                centDeviation: 0,
                isInRaga: true,
                swaraName: '',
                confidence: 0
            });
        }
    },

    /** Stop recording */
    stopRecording: function () {
        this.isRecording = false;

        // Disconnect AudioWorklet
        if (this.audioWorkletNode) {
            this.audioWorkletNode.disconnect();
            this.audioWorkletNode = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        // Send final stats to .NET
        if (this.dotNetRef) {
            const stats = this.computeStats();
            this.dotNetRef.invokeMethodAsync('OnRecordingStopped',
                stats.stability, stats.total, stats.correct, stats.mistakes
            ).catch(() => { });
        }

        console.log('[AudioInterop] Recording stopped');
    },

    computeStats: function () {
        const voiced = this.pitchHistory.filter(p => p.frequencyHz > 0 && p.confidence > 0.5);
        if (voiced.length === 0) return { stability: 0, total: 0, correct: 0, mistakes: 0 };

        const correct = voiced.filter(p => p.isInRaga).length;
        const mistakes = voiced.filter(p => !p.isInRaga).length;
        const stability = Math.round((correct / voiced.length) * 1000) / 10;

        return { stability, total: voiced.length, correct, mistakes };
    },

    /** Set the swara guide lines for the current raga/shruti */
    setSwaraLines: function (swaraData) {
        this.swaraLines = swaraData;
    },

    /** Set reference pitch data for comparison overlay */
    setReferencePitch: function (refData) {
        this.referencePitchHistory = refData || [];
    },

    /** Start the visualization render loop */
    startVisualization: function () {
        const render = () => {
            if (!this.canvas || !this.canvasCtx) return;
            this.drawFrame();
            this.animFrameId = requestAnimationFrame(render);
        };
        render();
    },

    /** Draw a single frame of the pitch visualization */
    drawFrame: function () {
        const ctx = this.canvasCtx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        if (this.swaraLines.length === 0) return;

        const freqs = this.swaraLines.map(s => s.frequencyHz);
        const minFreq = Math.min(...freqs) * 0.85;
        const maxFreq = Math.max(...freqs) * 1.15;

        const freqToY = (f) => {
            if (f <= 0) return h;
            const logMin = Math.log2(minFreq);
            const logMax = Math.log2(maxFreq);
            const logF = Math.log2(f);
            const ratio = (logF - logMin) / (logMax - logMin);
            return h - (ratio * (h - 60)) - 30;
        };

        const currentTime = this.isRecording ? (Date.now() - this.startTime) :
            (this.pitchHistory.length > 0 ? this.pitchHistory[this.pitchHistory.length - 1].timeMs : 0);
        const windowStart = Math.max(0, currentTime - this.maxVisibleTimeMs);
        const windowEnd = windowStart + this.maxVisibleTimeMs;

        const timeToX = (t) => ((t - windowStart) / this.maxVisibleTimeMs) * w;

        // Grid lines
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;
        const timeStep = 1000;
        for (let t = Math.ceil(windowStart / timeStep) * timeStep; t <= windowEnd; t += timeStep) {
            const x = timeToX(t);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.fillStyle = this.colors.timeline;
            ctx.font = '11px "Inter", sans-serif';
            ctx.fillText((t / 1000).toFixed(0) + 's', x + 3, h - 5);
        }

        // Swara guide lines
        this.swaraLines.forEach(swara => {
            const y = freqToY(swara.frequencyHz);
            ctx.strokeStyle = this.colors.swaraLine;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = this.colors.swaraLabel;
            ctx.font = 'bold 13px "Inter", sans-serif';
            ctx.fillText(swara.name, 8, y - 5);

            ctx.font = '10px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(255,183,77,0.5)';
            ctx.fillText(swara.frequencyHz.toFixed(0) + ' Hz', 8, y + 13);
        });

        // Reference pitch contour
        if (this.referencePitchHistory.length > 1) {
            ctx.strokeStyle = this.colors.reference;
            ctx.lineWidth = 3;
            ctx.beginPath();
            let started = false;
            this.referencePitchHistory.forEach(p => {
                if (p.timeMs < windowStart || p.timeMs > windowEnd) return;
                if (p.frequencyHz <= 0) { started = false; return; }
                const x = timeToX(p.timeMs);
                const y = freqToY(p.frequencyHz);
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        // User pitch line
        if (this.pitchHistory.length > 1) {
            const visiblePoints = this.pitchHistory.filter(
                p => p.timeMs >= windowStart && p.timeMs <= windowEnd && p.frequencyHz > 0
            );

            for (let i = 1; i < visiblePoints.length; i++) {
                const prev = visiblePoints[i - 1];
                const curr = visiblePoints[i];
                if (curr.timeMs - prev.timeMs > 200) continue;

                let color;
                if (!curr.isInRaga) color = this.colors.pitchBad;
                else if (Math.abs(curr.centDeviation) > 30) color = this.colors.pitchWarn;
                else color = this.colors.pitchGood;

                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(timeToX(prev.timeMs), freqToY(prev.frequencyHz));
                ctx.lineTo(timeToX(curr.timeMs), freqToY(curr.frequencyHz));
                ctx.stroke();

                if (curr.isInRaga && Math.abs(curr.centDeviation) <= 15) {
                    ctx.shadowColor = this.colors.pitchGood;
                    ctx.shadowBlur = 8;
                    ctx.strokeStyle = this.colors.pitchGood;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(timeToX(prev.timeMs), freqToY(prev.frequencyHz));
                    ctx.lineTo(timeToX(curr.timeMs), freqToY(curr.frequencyHz));
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }

            // Mistake blips
            visiblePoints.filter(p => !p.isInRaga).forEach(p => {
                const x = timeToX(p.timeMs);
                const y = freqToY(p.frequencyHz);
                ctx.fillStyle = this.colors.mistakeBlip;
                ctx.shadowColor = this.colors.mistakeBlip;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });
        }

        // Current pitch indicator
        if (this.isRecording && this.pitchHistory.length > 0) {
            const last = this.pitchHistory[this.pitchHistory.length - 1];
            if (last.frequencyHz > 0) {
                const y = freqToY(last.frequencyHz);
                const color = last.isInRaga ? this.colors.pitchGood : this.colors.pitchBad;

                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(w - 20, y);
                ctx.lineTo(w - 12, y - 8);
                ctx.lineTo(w - 4, y);
                ctx.lineTo(w - 12, y + 8);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;

                if (last.swaraName) {
                    ctx.fillStyle = color;
                    ctx.font = 'bold 14px "Inter", sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText(last.swaraName, w - 25, y + 5);
                    ctx.textAlign = 'left';
                }
            }
        }

        this.drawLegend(ctx, w);
    },

    drawLegend: function (ctx, w) {
        const legendItems = [
            { color: this.colors.pitchGood, label: 'In Tune' },
            { color: this.colors.pitchWarn, label: 'Slight Off' },
            { color: this.colors.pitchBad, label: 'Mistake' },
            { color: this.colors.reference, label: 'Reference' }
        ];

        let x = w - 310;
        const y = 18;
        legendItems.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.fillRect(x, y - 8, 12, 12);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '11px "Inter", sans-serif';
            ctx.fillText(item.label, x + 16, y + 2);
            x += 75;
        });
    },

    drawIdleState: function () {
        const ctx = this.canvasCtx;
        if (!ctx) return;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 12; i++) {
            const y = 30 + (i * (h - 60) / 11);
            ctx.strokeStyle = this.colors.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255,183,77,0.6)';
        ctx.font = '18px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Select a raga and shruti, then press Record to begin', w / 2, h / 2 - 10);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '13px "Inter", sans-serif';
        ctx.fillText('Your pitch will be visualized here in real-time', w / 2, h / 2 + 15);
        ctx.textAlign = 'left';
    },

    /** Stop any currently playing reference audio */
    stopReference: function () {
        // Stop all oscillators
        this.referenceOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) { }
        });
        this.referenceOscillators = [];

        // Close the reference audio context
        if (this.referenceCtx) {
            try { this.referenceCtx.close(); } catch (e) { }
            this.referenceCtx = null;
        }
    },

    /** Start High-Fidelity Buffer-based Tanpura (Pa-SA-SA-Sa) */
    startShrutiDrone: async function (saFrequencyHz) {
        try {
            console.log('[AudioInterop] Starting Real Tanpura at', saFrequencyHz, 'Hz');
            this.stopShrutiDrone();

            this.shrutiCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
            const ctx = this.shrutiCtx;

            this.shrutiGainNode = ctx.createGain();
            this.shrutiGainNode.gain.value = 0.18;
            this.shrutiGainNode.connect(ctx.destination);

            // Generate 4s tanpura cycle (repeats seamlessly)
            this.tanpuraBuffer = ctx.createBuffer(1, 44100 * 4, 44100);
            const data = this.tanpuraBuffer.getChannelData(0);

            // Carnatic tuning: Pa-SA-SA-Sa
            const strings = [
                { freq: saFrequencyHz * 1.5, phase: 0, vol: 0.5 },    // Pa
                { freq: saFrequencyHz, phase: 0.1, vol: 0.45 },      // SA 1
                { freq: saFrequencyHz, phase: 0.25, vol: 0.42 },     // SA 2
                { freq: saFrequencyHz * 0.5, phase: 0, vol: 0.6 }    // Sa (Kharaj)
            ];

            // Generate REAL jivari bloom using additive synthesis
            for (let i = 0; i < data.length; i++) {
                let sample = 0;
                const t = i / 44100;

                strings.forEach((str, idx) => {
                    // Stagger the plucks: Pa(0s), SA(1s), SA(2s), Sa(3s)
                    const pluckOffset = idx;
                    let stringTime = t - pluckOffset;
                    if (stringTime < 0) stringTime += 4; // Seamless wrap

                    // Individual string envelope (exponential decay)
                    const env = Math.pow(0.4, stringTime * 0.9);

                    // Each string has a slightly offset bloom phase
                    const bloom = (Math.sin(t * 0.8 + idx) + 1) / 2;

                    const fund = Math.sin(t * str.freq * 2 * Math.PI + str.phase) * (1 - bloom * 0.6);
                    const h2 = Math.sin(t * str.freq * 4 * Math.PI) * bloom * 0.5;
                    const h3 = Math.sin(t * str.freq * 6 * Math.PI) * bloom * 0.3;
                    const h5 = Math.sin(t * str.freq * 10 * Math.PI) * bloom * 0.15;

                    sample += (fund + h2 + h3 + h5) * str.vol * env * 0.25;
                });

                data[i] = sample;
            }

            // Loop forever
            this.tanpuraSource = ctx.createBufferSource();
            this.tanpuraSource.buffer = this.tanpuraBuffer;
            this.tanpuraSource.loop = true;
            this.tanpuraSource.connect(this.shrutiGainNode);
            this.tanpuraSource.start();

            console.log('[AudioInterop] Real Tanpura started successfully');
        } catch (e) {
            console.error('[AudioInterop] Error starting Tanpura:', e);
        }
    },

    /** Stop all Tanpura audio and release buffers */
    stopShrutiDrone: function () {
        console.log('[AudioInterop] Stopping Tanpura');
        if (this.tanpuraSource) {
            try { this.tanpuraSource.stop(); } catch (e) { }
            this.tanpuraSource = null;
        }
        if (this.tanpuraBuffer) {
            this.tanpuraBuffer = null;
        }
        if (this.shrutiCtx) {
            try { this.shrutiCtx.close(); } catch (e) { }
            this.shrutiCtx = null;
        }
    },

    /** Start metronome */
    startMetronome: async function (beatsPerMinute) {
        try {
            console.log('[AudioInterop] Starting metronome at', beatsPerMinute, 'BPM');
            if (this.metronomeIntervalId) {
                this.stopMetronome();
            }

            this.metronomeCtx = new (window.AudioContext || window.webkitAudioContext)();
            const intervalMs = (60 / beatsPerMinute) * 1000;

            const playBeat = () => {
                this.playMetronomeClick(1);
            };

            // Play first beat immediately
            playBeat();

            // Continue at regular intervals
            this.metronomeIntervalId = setInterval(playBeat, intervalMs);
            console.log('[AudioInterop] Metronome started successfully');
        } catch (e) {
            console.error('[AudioInterop] Error starting metronome:', e);
        }
    },

    /** Set metronome BPM (while playing) */
    setMetronomeBpm: function (beatsPerMinute) {
        try {
            console.log('[AudioInterop] Setting metronome BPM to', beatsPerMinute);
            if (this.metronomeIntervalId) {
                clearInterval(this.metronomeIntervalId);
                const intervalMs = (60 / beatsPerMinute) * 1000;

                const playBeat = () => {
                    this.playMetronomeClick(1);
                };

                this.metronomeIntervalId = setInterval(playBeat, intervalMs);
            }
        } catch (e) {
            console.error('[AudioInterop] Error setting metronome BPM:', e);
        }
    },

    /** Play a single metronome click */
    playMetronomeClick: function (beatNumber, ctx, atTime) {
        const audioCtx = ctx || this.metronomeCtx;
        if (!audioCtx) return;

        const time = atTime || audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.value = beatNumber === 1 ? 1200 : 1000;

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(0.2, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(time);
        osc.stop(time + 0.1);
    },

    /** Stop metronome */
    stopMetronome: function () {
        try {
            console.log('[AudioInterop] Stopping metronome');
            if (this.metronomeIntervalId) {
                clearInterval(this.metronomeIntervalId);
                this.metronomeIntervalId = null;
            }

            if (this.metronomeCtx) {
                try { this.metronomeCtx.close(); } catch (e) { }
                this.metronomeCtx = null;
            }
            console.log('[AudioInterop] Metronome stopped');
        } catch (e) {
            console.error('[AudioInterop] Error stopping metronome:', e);
        }
    },

    /** Generate and play a reference tone (sine wave arpeggio of the raga) */
    playReferenceTone: async function (swaraFrequencies, durationPerNote) {
        // Stop any previous reference playback first!
        this.stopReference();

        this.referenceCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this.referenceCtx;
        this.referenceOscillators = [];

        // Generate reference pitch data
        this.referencePitchHistory = [];
        let refTime = 0;

        for (let i = 0; i < swaraFrequencies.length; i++) {
            const freq = swaraFrequencies[i];
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, ctx.currentTime + i * durationPerNote);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * durationPerNote + 0.05);
            gain.gain.setValueAtTime(0.3, ctx.currentTime + (i + 1) * durationPerNote - 0.05);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (i + 1) * durationPerNote);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + i * durationPerNote);
            osc.stop(ctx.currentTime + (i + 1) * durationPerNote);
            this.referenceOscillators.push(osc);

            // Play metronome click along with reference note
            this.playMetronomeClick(1, ctx, ctx.currentTime + i * durationPerNote);

            for (let t = 0; t < durationPerNote * 1000; t += 50) {
                this.referencePitchHistory.push({
                    timeMs: refTime + t,
                    frequencyHz: freq,
                    centDeviation: 0,
                    isInRaga: true,
                    swaraName: ''
                });
            }
            refTime += durationPerNote * 1000;
        }

        // Animate
        this.pitchHistory = [];
        this.startTime = Date.now();
        this.isRecording = true;

        const totalDuration = swaraFrequencies.length * durationPerNote;
        setTimeout(() => {
            this.isRecording = false;
            this.stopReference();
        }, totalDuration * 1000 + 500);

        this.startVisualization();
    },

    /** Get current pitch history stats */
    getStats: function () {
        return this.computeStats();
    },

    /** Clean up all resources */
    dispose: function () {
        this.stopRecording();
        this.stopReference();
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }
    }
};

// Global error handler for debugging
window.addEventListener('error', function (e) {
    console.error('[GLOBAL ERROR]', e.message, 'at', e.filename, 'line', e.lineno);
});

// Log when script loads
console.log('[AudioInterop] Script loaded, checking for functions...');
console.log('[AudioInterop] startShrutiDrone exists:', typeof window.AudioInterop.startShrutiDrone);
console.log('[AudioInterop] startMetronome exists:', typeof window.AudioInterop.startMetronome);
console.log('[AudioInterop] stopShrutiDrone exists:', typeof window.AudioInterop.stopShrutiDrone);
console.log('[AudioInterop] stopMetronome exists:', typeof window.AudioInterop.stopMetronome);
