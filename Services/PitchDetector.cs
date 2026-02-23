namespace Carnatic.Services;

/// <summary>
/// YIN autocorrelation-based pitch detector for monophonic voice.
/// Reference: "YIN, a fundamental frequency estimator for speech and music"
/// by Alain de Cheveigné and Hideki Kawahara (2002).
/// </summary>
public class PitchDetector
{
    private readonly int _sampleRate;
    private readonly double _threshold;
    private readonly int _minPeriod; // corresponds to max frequency
    private readonly int _maxPeriod; // corresponds to min frequency

    /// <summary>
    /// Creates a new YIN pitch detector.
    /// </summary>
    /// <param name="sampleRate">Audio sample rate in Hz (e.g., 44100)</param>
    /// <param name="threshold">YIN confidence threshold (0.0-1.0, lower = stricter). Default 0.15</param>
    /// <param name="minFrequency">Minimum detectable frequency in Hz. Default 80 (low male voice)</param>
    /// <param name="maxFrequency">Maximum detectable frequency in Hz. Default 1000 (high female voice)</param>
    public PitchDetector(int sampleRate = 44100, double threshold = 0.15,
                         double minFrequency = 80, double maxFrequency = 1000)
    {
        _sampleRate = sampleRate;
        _threshold = threshold;
        _minPeriod = (int)(_sampleRate / maxFrequency);
        _maxPeriod = (int)(_sampleRate / minFrequency);
    }

    /// <summary>
    /// Detects the fundamental frequency from a buffer of audio samples.
    /// </summary>
    /// <param name="audioBuffer">PCM audio samples (float, -1 to 1)</param>
    /// <returns>Detected frequency in Hz, or -1 if no pitch detected (silence/noise)</returns>
    public PitchResult DetectPitch(float[] audioBuffer)
    {
        if (audioBuffer.Length < _maxPeriod * 2)
            return new PitchResult { Frequency = -1, Confidence = 0 };

        int halfLength = audioBuffer.Length / 2;

        // Step 1: Difference function
        double[] difference = new double[halfLength];
        for (int tau = 0; tau < halfLength; tau++)
        {
            double sum = 0;
            for (int i = 0; i < halfLength; i++)
            {
                double delta = audioBuffer[i] - audioBuffer[i + tau];
                sum += delta * delta;
            }
            difference[tau] = sum;
        }

        // Step 2: Cumulative mean normalized difference function (CMND)
        double[] cmnd = new double[halfLength];
        cmnd[0] = 1;
        double runningSum = 0;
        for (int tau = 1; tau < halfLength; tau++)
        {
            runningSum += difference[tau];
            cmnd[tau] = difference[tau] * tau / runningSum;
        }

        // Step 3: Absolute threshold
        int tauEstimate = -1;
        for (int tau = _minPeriod; tau < Math.Min(_maxPeriod, halfLength); tau++)
        {
            if (cmnd[tau] < _threshold)
            {
                // Find the local minimum after crossing threshold
                while (tau + 1 < halfLength && cmnd[tau + 1] < cmnd[tau])
                {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate == -1)
            return new PitchResult { Frequency = -1, Confidence = 0 };

        // Step 4: Parabolic interpolation for sub-sample accuracy
        double betterTau = tauEstimate;
        if (tauEstimate > 0 && tauEstimate < halfLength - 1)
        {
            double s0 = cmnd[tauEstimate - 1];
            double s1 = cmnd[tauEstimate];
            double s2 = cmnd[tauEstimate + 1];

            double denominator = 2 * (2 * s1 - s2 - s0);
            if (Math.Abs(denominator) > 1e-10)
            {
                betterTau = tauEstimate + (s2 - s0) / denominator;
            }
        }

        double frequency = _sampleRate / betterTau;
        double confidence = 1.0 - cmnd[tauEstimate];

        return new PitchResult
        {
            Frequency = frequency,
            Confidence = Math.Max(0, Math.Min(1, confidence))
        };
    }
}

public class PitchResult
{
    public double Frequency { get; set; }
    public double Confidence { get; set; }
}
