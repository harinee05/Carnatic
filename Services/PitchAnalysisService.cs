using Carnatic.Models;

namespace Carnatic.Services;

/// <summary>
/// Analyzes pitch data in the context of Carnatic music theory.
/// Maps raw frequencies to swaras, computes deviations, and tracks mistakes.
/// </summary>
public class PitchAnalysisService
{
    private readonly PitchDetector _pitchDetector;

    /// <summary>
    /// Deviation threshold in cents — beyond this, the note is considered "off".
    /// 50 cents = half a semitone.
    /// </summary>
    public double DeviationThresholdCents { get; set; } = 50;

    public PitchAnalysisService()
    {
        _pitchDetector = new PitchDetector(sampleRate: 44100, threshold: 0.15);
    }

    /// <summary>
    /// Analyze a chunk of audio samples and produce a PitchDataPoint.
    /// </summary>
    public PitchDataPoint AnalyzeChunk(float[] audioChunk, double timeMs,
                                        double saFrequencyHz, Raga raga)
    {
        var pitchResult = _pitchDetector.DetectPitch(audioChunk);

        if (pitchResult.Frequency <= 0 || pitchResult.Confidence < 0.5)
        {
            return new PitchDataPoint
            {
                TimeMs = timeMs,
                FrequencyHz = 0,
                NearestSwara = null,
                CentDeviation = 0,
                IsInRaga = true, // silence is not a mistake
                Confidence = pitchResult.Confidence
            };
        }

        var (nearestSwara, centDeviation, _) = CarnaticCatalog.FindNearestSwara(
            pitchResult.Frequency, saFrequencyHz);

        bool isInRaga = raga.AllowedSwaras.Contains(nearestSwara) &&
                        Math.Abs(centDeviation) <= DeviationThresholdCents;

        return new PitchDataPoint
        {
            TimeMs = timeMs,
            FrequencyHz = pitchResult.Frequency,
            NearestSwara = nearestSwara,
            CentDeviation = centDeviation,
            IsInRaga = isInRaga,
            Confidence = pitchResult.Confidence
        };
    }

    /// <summary>
    /// Compute an overall comparison result from a list of analyzed pitch points.
    /// </summary>
    public ComparisonResult ComputeComparison(List<PitchDataPoint> userPitchData, Raga raga)
    {
        var voicedPoints = userPitchData.Where(p => p.FrequencyHz > 0 && p.Confidence >= 0.5).ToList();

        if (voicedPoints.Count == 0)
        {
            return new ComparisonResult
            {
                StabilityScore = 0,
                TotalNotes = 0,
                CorrectNotes = 0,
                MistakeCount = 0
            };
        }

        int correctNotes = voicedPoints.Count(p => p.IsInRaga);
        double stabilityScore = (double)correctNotes / voicedPoints.Count * 100;

        // Find contiguous mistake regions
        var mistakes = new List<MistakeMarker>();
        MistakeMarker? currentMistake = null;

        foreach (var point in voicedPoints.Where(p => !p.IsInRaga))
        {
            if (currentMistake == null ||
                point.TimeMs - currentMistake.EndTimeMs > 200) // 200ms gap = new mistake
            {
                currentMistake = new MistakeMarker
                {
                    StartTimeMs = point.TimeMs,
                    EndTimeMs = point.TimeMs,
                    ActualSwara = point.NearestSwara,
                    DeviationCents = point.CentDeviation,
                    Description = GetMistakeDescription(point, raga)
                };
                mistakes.Add(currentMistake);
            }
            else
            {
                currentMistake.EndTimeMs = point.TimeMs;
            }
        }

        return new ComparisonResult
        {
            StabilityScore = Math.Round(stabilityScore, 1),
            TotalNotes = voicedPoints.Count,
            CorrectNotes = correctNotes,
            MistakeCount = mistakes.Count,
            Mistakes = mistakes
        };
    }

    private string GetMistakeDescription(PitchDataPoint point, Raga raga)
    {
        if (point.NearestSwara == null)
            return "Pitch too unstable to detect";

        if (!raga.AllowedSwaras.Contains(point.NearestSwara.Value))
            return $"{point.NearestSwara} is not in {raga.Name}";

        if (Math.Abs(point.CentDeviation) > DeviationThresholdCents)
            return $"{point.NearestSwara} is {Math.Abs(point.CentDeviation):F0} cents {(point.CentDeviation > 0 ? "sharp" : "flat")}";

        return "Unknown deviation";
    }
}
