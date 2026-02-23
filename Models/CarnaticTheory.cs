namespace Carnatic.Models;

/// <summary>
/// The 16 swarasthanas (note positions) in Carnatic music.
/// Sa and Pa are fixed (achala swaras). The rest are variable (chala swaras).
/// </summary>
public enum Swara
{
    Sa,   // Shadjam - fixed
    Ri1,  // Shuddha Rishabham
    Ri2,  // Chatushruti Rishabham (= Shuddha Gandharam)
    Ri3,  // Shatshruti Rishabham (= Sadharana Gandharam)
    Ga1,  // Shuddha Gandharam (= Chatushruti Rishabham)
    Ga2,  // Sadharana Gandharam (= Shatshruti Rishabham)
    Ga3,  // Antara Gandharam
    Ma1,  // Shuddha Madhyamam
    Ma2,  // Prati Madhyamam
    Pa,   // Panchamam - fixed
    Da1,  // Shuddha Dhaivatam
    Da2,  // Chatushruti Dhaivatam (= Shuddha Nishadam)
    Da3,  // Shatshruti Dhaivatam (= Kaisiki Nishadam)
    Ni1,  // Shuddha Nishadam (= Chatushruti Dhaivatam)
    Ni2,  // Kaisiki Nishadam (= Shatshruti Dhaivatam)
    Ni3   // Kakali Nishadam
}

/// <summary>
/// Represents a raga with its arohanam (ascending) and avarohanam (descending) patterns.
/// </summary>
public class Raga
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int MelaNumber { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<Swara> Arohanam { get; set; } = new();
    public List<Swara> Avarohanam { get; set; } = new();

    /// <summary>
    /// All unique swaras used in this raga (union of arohanam and avarohanam).
    /// </summary>
    public HashSet<Swara> AllowedSwaras =>
        new(Arohanam.Concat(Avarohanam));
}

/// <summary>
/// Shruti (tonic pitch) mapping — the base frequency for Sa.
/// </summary>
public class Shruti
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public double SaFrequencyHz { get; set; }
    public double Kattai { get; set; }
}

/// <summary>
/// A single pitch data point from analysis.
/// </summary>
public class PitchDataPoint
{
    public double TimeMs { get; set; }
    public double FrequencyHz { get; set; }
    public Swara? NearestSwara { get; set; }
    public double CentDeviation { get; set; }
    public bool IsInRaga { get; set; }
    public double Confidence { get; set; }
}

/// <summary>
/// Result of comparing user recording against reference.
/// </summary>
public class ComparisonResult
{
    public double StabilityScore { get; set; }
    public int TotalNotes { get; set; }
    public int CorrectNotes { get; set; }
    public int MistakeCount { get; set; }
    public List<MistakeMarker> Mistakes { get; set; } = new();
}

public class MistakeMarker
{
    public double StartTimeMs { get; set; }
    public double EndTimeMs { get; set; }
    public Swara? ExpectedSwara { get; set; }
    public Swara? ActualSwara { get; set; }
    public double DeviationCents { get; set; }
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// Static catalog of Carnatic music data — ragas, shrutis, and frequency calculations.
/// </summary>
public static class CarnaticCatalog
{
    /// <summary>
    /// Semitone offsets from Sa for each swara (using 12-TET intervals).
    /// </summary>
    private static readonly Dictionary<Swara, int> SwaraSemitoneOffsets = new()
    {
        { Swara.Sa,  0 },
        { Swara.Ri1, 1 },
        { Swara.Ri2, 2 },  // = Ga1
        { Swara.Ri3, 3 },  // = Ga2
        { Swara.Ga1, 2 },  // = Ri2
        { Swara.Ga2, 3 },  // = Ri3
        { Swara.Ga3, 4 },
        { Swara.Ma1, 5 },
        { Swara.Ma2, 6 },
        { Swara.Pa,  7 },
        { Swara.Da1, 8 },
        { Swara.Da2, 9 },  // = Ni1
        { Swara.Da3, 10 }, // = Ni2
        { Swara.Ni1, 9 },  // = Da2
        { Swara.Ni2, 10 }, // = Da3
        { Swara.Ni3, 11 },
    };

    /// <summary>
    /// Computes the frequency (Hz) of a given swara at a given shruti, in a given octave.
    /// Octave 0 = middle octave (madhya sthayi), -1 = mandra, +1 = tara.
    /// </summary>
    public static double GetSwaraFrequency(Swara swara, double saFrequencyHz, int octaveOffset = 0)
    {
        int semitones = SwaraSemitoneOffsets[swara];
        return saFrequencyHz * Math.Pow(2, (semitones / 12.0) + octaveOffset);
    }

    /// <summary>
    /// Given a frequency and a shruti, find the nearest swara and the cent deviation.
    /// </summary>
    public static (Swara swara, double centDeviation, int octaveOffset) FindNearestSwara(
        double frequencyHz, double saFrequencyHz)
    {
        if (frequencyHz <= 0 || saFrequencyHz <= 0)
            return (Swara.Sa, 0, 0);

        // Total semitones from Sa
        double totalSemitones = 12.0 * Math.Log2(frequencyHz / saFrequencyHz);
        
        // Find the octave offset
        int octaveOffset = (int)Math.Floor(totalSemitones / 12.0);
        double semitonesInOctave = totalSemitones - (octaveOffset * 12.0);
        if (semitonesInOctave < 0) semitonesInOctave += 12;

        // Find the nearest swara
        Swara nearestSwara = Swara.Sa;
        double minCentDev = double.MaxValue;

        // Only check the canonical 12 positions (avoid duplicates like Ri2/Ga1)
        var canonicalSwaras = new[] {
            Swara.Sa, Swara.Ri1, Swara.Ri2, Swara.Ri3,
            Swara.Ga3, Swara.Ma1, Swara.Ma2, Swara.Pa,
            Swara.Da1, Swara.Da2, Swara.Da3, Swara.Ni3
        };

        foreach (var swara in canonicalSwaras)
        {
            int swaraSemitone = SwaraSemitoneOffsets[swara];
            double centDev = (semitonesInOctave - swaraSemitone) * 100; // convert semitones to cents

            // Wrap around for Sa comparison (handle going past Ni3 → Sa)
            if (Math.Abs(centDev) > 600)
            {
                centDev = centDev > 0 ? centDev - 1200 : centDev + 1200;
            }

            if (Math.Abs(centDev) < Math.Abs(minCentDev))
            {
                minCentDev = centDev;
                nearestSwara = swara;
            }
        }

        return (nearestSwara, minCentDev, octaveOffset);
    }

    /// <summary>
    /// Available shrutis (tonic pitches) for selection.
    /// Common kattai values used in Carnatic music.
    /// </summary>
    public static List<Shruti> GetShrutis() => new()
    {
        new Shruti { Name = "C",  DisplayName = "C - 1 Kattai",     SaFrequencyHz = 130.81, Kattai = 1 },
        new Shruti { Name = "C#", DisplayName = "C# - 1½ Kattai",   SaFrequencyHz = 138.59, Kattai = 1.5 },
        new Shruti { Name = "D",  DisplayName = "D - 2 Kattai",     SaFrequencyHz = 146.83, Kattai = 2 },
        new Shruti { Name = "D#", DisplayName = "D# - 2½ Kattai",   SaFrequencyHz = 155.56, Kattai = 2.5 },
        new Shruti { Name = "E",  DisplayName = "E - 3 Kattai",     SaFrequencyHz = 164.81, Kattai = 3 },
        new Shruti { Name = "F",  DisplayName = "F - 3½ Kattai",    SaFrequencyHz = 174.61, Kattai = 3.5 },
        new Shruti { Name = "F#", DisplayName = "F# - 4 Kattai",    SaFrequencyHz = 185.00, Kattai = 4 },
        new Shruti { Name = "G",  DisplayName = "G - 4½ Kattai",    SaFrequencyHz = 196.00, Kattai = 4.5 },
        new Shruti { Name = "G#", DisplayName = "G# - 5 Kattai",    SaFrequencyHz = 207.65, Kattai = 5 },
        new Shruti { Name = "A",  DisplayName = "A - 5½ Kattai",    SaFrequencyHz = 220.00, Kattai = 5.5 },
        new Shruti { Name = "A#", DisplayName = "A# - 6 Kattai",    SaFrequencyHz = 233.08, Kattai = 6 },
        new Shruti { Name = "B",  DisplayName = "B - 6½ Kattai",    SaFrequencyHz = 246.94, Kattai = 6.5 },
    };

    /// <summary>
    /// Seed ragas — starting with Mayamalavagowla.
    /// </summary>
    public static List<Raga> GetRagas() => new()
    {
        new Raga
        {
            Name = "Mayamalavagowla",
            DisplayName = "Mayamalavagowla (Mela 15)",
            MelaNumber = 15,
            Description = "The first raga taught in Carnatic music. A sampoorna (complete) raga using all 7 swaras.",
            Arohanam = new List<Swara> { Swara.Sa, Swara.Ri1, Swara.Ga3, Swara.Ma1, Swara.Pa, Swara.Da1, Swara.Ni3 },
            Avarohanam = new List<Swara> { Swara.Ni3, Swara.Da1, Swara.Pa, Swara.Ma1, Swara.Ga3, Swara.Ri1, Swara.Sa }
        },
        new Raga
        {
            Name = "Shankarabharanam",
            DisplayName = "Shankarabharanam (Mela 29)",
            MelaNumber = 29,
            Description = "Equivalent to the Western major scale. A bright, auspicious raga.",
            Arohanam = new List<Swara> { Swara.Sa, Swara.Ri2, Swara.Ga3, Swara.Ma1, Swara.Pa, Swara.Da2, Swara.Ni3 },
            Avarohanam = new List<Swara> { Swara.Ni3, Swara.Da2, Swara.Pa, Swara.Ma1, Swara.Ga3, Swara.Ri2, Swara.Sa }
        },
        new Raga
        {
            Name = "Mohanam",
            DisplayName = "Mohanam (Janya of Mela 28)",
            MelaNumber = 28,
            Description = "A popular pentatonic raga (audava) with 5 swaras. Bright and melodious.",
            Arohanam = new List<Swara> { Swara.Sa, Swara.Ri2, Swara.Ga3, Swara.Pa, Swara.Da2 },
            Avarohanam = new List<Swara> { Swara.Da2, Swara.Pa, Swara.Ga3, Swara.Ri2, Swara.Sa }
        }
    };
}
