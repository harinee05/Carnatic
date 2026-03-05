# Carnatic Raga Trainer - Technical Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [File-by-File Analysis](#file-by-file-analysis)
   - [Program.cs](#programcs-entry-point)
   - [Components/App.razor](#componentsapprazor-root-component)
   - [Components/Pages/RagaTrainer.razor](#componentspagesragatrainerrazor-main-page)
   - [Models/CarnaticTheory.cs](#modelscarnatictheorycs-domain-models)
   - [Services/PitchDetector.cs](#servicespitchdetectorcs-yin-algorithm)
   - [Services/PitchAnalysisService.cs](#servicespitchanalysisservicecs-domain-logic)
   - [wwwroot/js/audioInterop.js](#wwwrootjsaudiointeropjs-web-audio-api)
   - [wwwroot/css/app.css](#wwwrootcssappcss-styling)
5. [Component Lifecycle](#component-lifecycle)
6. [Data Flow Architecture](#data-flow-architecture)
7. [Audio Processing Pipeline](#audio-processing-pipeline)
8. [.NET Concepts Used](#net-concepts-used)
9. [Blazor-Specific Patterns](#blazor-specific-patterns)
10. [State Management](#state-management)
11. [Error Handling](#error-handling)
12. [Performance Considerations](#performance-considerations)

---

## System Overview

**Carnatic Raga Trainer** is a real-time pitch visualization and practice tool for Carnatic music students. It runs entirely in the browser using Blazor WebAssembly, capturing audio from the user's microphone, analyzing pitch in real-time using the YIN algorithm, and visualizing the results against Carnatic music theory.

### Core Features
1. **Raga Selection**: Choose from multiple Carnatic ragas
2. **Shruti (Tonic) Selection**: Set the base pitch (1-6.5 kattai)
3. **Shruti Drone**: Continuous Sa-Pa-Sa background reference
4. **Metronome**: Adjustable BPM (30-240) with accented first beat
5. **Real-time Recording**: Live pitch capture from microphone
6. **Reference Playback**: Play raga arohanam/avarohanam
7. **Visualization**: Canvas-based pitch trajectory display
8. **Analytics**: Stability score, note detection, mistake counting

---

## Technology Stack

### Backend/Framework
- **.NET 8**: Latest LTS version of .NET
- **Blazor WebAssembly**: Client-side WebAssembly execution
- **C# 12**: Modern C# features including pattern matching, nullable reference types

### Frontend
- **JavaScript (ES6+)**: Web Audio API for audio processing
- **HTML5 Canvas**: Real-time pitch visualization
- **CSS3**: Custom dark theme with saffron/gold accents

### Audio Processing
- **Web Audio API**: Browser-native audio context and oscillators
- **ScriptProcessorNode**: Real-time audio buffer processing
- **YIN Algorithm**: Fundamental frequency detection

### Build & Deploy
- **GitHub Pages**: Static hosting for WASM app
- **Azure Pipelines**: CI/CD (configured in `.github/workflows`)

---

## Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Blazor WebAssembly (.NET 8)                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           Razor Components (UI Layer)               │  │  │
│  │  │  ┌──────────────────┐  ┌──────────────────────┐    │  │  │
│  │  │  │ RagaTrainer.razor│  │   App.razor (Router) │    │  │  │
│  │  │  │ - State Mgmt     │  │ - Routing            │    │  │  │
│  │  │  │ - Event Handling │  │ - Layout Management  │    │  │  │
│  │  │  │ - JS Interop     │  │                      │    │  │  │
│  │  │  └──────────────────┘  └──────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Service Layer (C#)                     │  │  │
│  │  │  ┌──────────────┐      ┌────────────────────┐      │  │  │
│  │  │  │ PitchDetector│      │ PitchAnalysisService│     │  │  │
│  │  │  │ (YIN Algo)   │      │ (Domain Logic)      │     │  │  │
│  │  │  └──────────────┘      └────────────────────┘      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Domain Models (C#)                     │  │  │
│  │  │  Raga, Swara, Shruti, PitchDataPoint, etc.         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    JavaScript Layer                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            audioInterop.js (Web Audio API)          │  │  │
│  │  │  - AudioContext management                          │  │  │
│  │  │  - ScriptProcessorNode (buffer processing)          │  │  │
│  │  │  - OscillatorNode (shruti drone, metronome)         │  │  │
│  │  │  - Canvas rendering (requestAnimationFrame)         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Architecture

1. **Presentation Layer**: Razor Components (UI)
2. **Service Layer**: PitchDetector, PitchAnalysisService
3. **Domain Layer**: Models (Raga, Swara, Shruti, etc.)
4. **Infrastructure Layer**: JavaScript Interop (Web Audio API)

---

## File-by-File Analysis

### Program.cs (Entry Point)

**Location**: `/Program.cs`

**Purpose**: Application entry point and dependency injection configuration for Blazor WebAssembly.

**Key Concepts**:
- `WebAssemblyHostBuilder`: Creates and configures the WASM host
- `RootComponents`: Registers the root `<App>` component
- Dependency Injection (DI): Registers services with scoped lifetime

**Code Breakdown**:

```csharp
var builder = WebAssemblyHostBuilder.CreateDefault(args);
// Root component injection - mounts Blazor to #app element
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Service registration with DI container
builder.Services.AddScoped<PitchAnalysisService>();
builder.Services.AddScoped(sp => new HttpClient { 
    BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) 
});

await builder.Build().RunAsync();
```

**DI Lifetimes Explained**:
- `AddScoped`: New instance per user session (ideal for services holding state)
- In WASM, "scoped" essentially means "singleton per browser tab"

**Execution Flow**:
1. Host builder initializes
2. Root components registered
3. Services added to DI container
4. App builds and runs asynchronously

---

### Components/App.razor (Root Component)

**Location**: `/Components/App.razor`

**Purpose**: Root routing component that handles navigation and layout management.

**Key Concepts**:
- **Router Component**: Blazor's built-in routing mechanism
- **RouteView**: Renders the matched page component with layout
- **NotFound**: Fallback UI for unmatched routes
- **FocusOnNavigate**: Accessibility feature for screen readers

**Code Breakdown**:

```razor
<Router AppAssembly="@typeof(Program).Assembly">
    <Found Context="routeData">
        <RouteView RouteData="@routeData" 
                   DefaultLayout="@typeof(Layout.MainLayout)" />
        <FocusOnNavigate RouteData="@routeData" Selector="h1" />
    </Found>
    <NotFound>
        <PageTitle>Not found</PageTitle>
        <LayoutView Layout="@typeof(Layout.MainLayout)">
            <p role="alert">Sorry, there's nothing at this address.</p>
        </LayoutView>
    </NotFound>
</Router>
```

**Routing Mechanism**:
1. `Router` scans `Program.Assembly` for components with `@page` directive
2. Matches current URL to route templates
3. `Found` block: Renders matched component with layout
4. `NotFound` block: Renders 404 UI

**Blazor Lifecycle**:
- `App.razor` is instantiated once at app startup
- Routing happens on initial load and navigation events
- No manual navigation code needed (declarative routing)

---

### Components/Pages/RagaTrainer.razor (Main Page)

**Location**: `/Components/Pages/RagaTrainer.razor`

**Purpose**: Main application page combining UI controls, state management, and JavaScript interop for audio processing.

**Architecture**: Component-Based MVVM Pattern

**Key Sections**:

#### 1. Directives and Injections

```razor
@page "/"                          // Route template (homepage)
@using Carnatic.Models            // Namespace imports
@using Carnatic.Services
@inject IJSRuntime JSRuntime       // JS interop service
@inject IJSInProcessRuntime JSInProcessRuntime  // Synchronous JS calls
@implements IAsyncDisposable       // Cleanup on component disposal
```

**Dependency Injection**:
- `IJSRuntime`: Asynchronous JS interop (preferred, non-blocking)
- `IJSInProcessRuntime`: Synchronous JS calls (faster but blocks UI thread)

#### 2. State Variables

```csharp
// Application State
private bool isInitialized = false;
private bool isRecording = false;
private bool isShrutiPlaying = false;      // NEW: Drone state
private bool isMetronomePlaying = false;   // NEW: Metronome state
private int bpm = 60;                      // NEW: Metronome tempo
private string? errorMessage = null;       // NEW: Error display

// Music Theory State
private List<Raga> ragas = CarnaticCatalog.GetRagas();
private List<Shruti> shrutis = CarnaticCatalog.GetShrutis();
private string selectedRagaName = "Mayamalavagowla";
private string selectedShrutiName = "C";
private Raga? selectedRaga;
private Shruti? selectedShruti;

// Analytics State
private double stabilityScore = 0;
private int totalNotesDetected = 0;
private int correctNotes = 0;
private int mistakeCount = 0;
```

**State Management Pattern**:
- **Private fields**: Component-internal state
- **@bind directives**: Two-way data binding to UI controls
- **StateHasChanged()**: Triggers re-render when state changes

#### 3. Component Lifecycle: OnAfterRenderAsync

```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (firstRender)
    {
        try
        {
            // Create .NET object reference for JS callbacks
            dotNetRef = DotNetObjectReference.Create(this);
            
            // Initialize JS audio system
            await JSRuntime.InvokeVoidAsync(
                "AudioInterop.initialize", 
                dotNetRef, 
                "pitchCanvas"
            );
            
            // Load initial raga/shruti
            selectedRaga = ragas.FirstOrDefault(r => r.Name == selectedRagaName);
            selectedShruti = shrutis.FirstOrDefault(s => s.Name == selectedShrutiName);
            
            // Send swara configuration to JS
            await UpdateSwaraConfig();
            
            isInitialized = true;
            StateHasChanged();  // Trigger re-render
        }
        catch (Exception ex)
        {
            LogError($"Initialization failed: {ex.Message}");
        }
    }
}
```

**Lifecycle Explained**:
1. **firstRender**: true only on initial component render
2. **DotNetObjectReference**: Creates handle for JS → .NET callbacks
3. **InvokeVoidAsync**: Calls JS function (no return value expected)
4. **StateHasChanged**: Forces UI update after async operations

#### 4. Event Handlers

##### a) Raga Change Handler

```csharp
private async Task OnRagaChanged()
{
    selectedRaga = ragas.FirstOrDefault(r => r.Name == selectedRagaName);
    await UpdateSwaraConfig();  // Update JS with new swara frequencies
    ResetStats();               // Clear previous session stats
}
```

**Two-Way Binding**:
```razor
<select @bind="selectedRagaName" @bind:after="OnRagaChanged">
    @foreach (var raga in ragas)
    {
        <option value="@raga.Name">@raga.DisplayName</option>
    }
</select>
```

- `@bind`: Updates `selectedRagaName` on dropdown change
- `@bind:after`: Calls `OnRagaChanged` after binding completes

##### b) Shruti Drone Toggle (NEW)

```csharp
private async Task ToggleShruti()
{
    try
    {
        if (isShrutiPlaying)
        {
            isShrutiPlaying = false;
            await JSRuntime.InvokeVoidAsync("AudioInterop.stopShrutiDrone");
        }
        else
        {
            isShrutiPlaying = true;
            if (selectedShruti != null)
            {
                await JSRuntime.InvokeVoidAsync(
                    "AudioInterop.startShrutiDrone", 
                    selectedShruti.SaFrequencyHz
                );
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error toggling shruti: {ex.Message}");
        isShrutiPlaying = false;
    }
}
```

**JS Interop Pattern**:
1. Toggle local state
2. Call corresponding JS function
3. Pass parameters (frequency in Hz)
4. Handle errors gracefully

##### c) Metronome Toggle (NEW)

```csharp
private async Task ToggleMetronome()
{
    try
    {
        if (isMetronomePlaying)
        {
            isMetronomePlaying = false;
            await JSRuntime.InvokeVoidAsync("AudioInterop.stopMetronome");
        }
        else
        {
            isMetronomePlaying = true;
            await JSRuntime.InvokeVoidAsync("AudioInterop.startMetronome", bpm);
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error toggling metronome: {ex.Message}");
        isMetronomePlaying = false;
    }
}

private async Task OnBpmChanged()
{
    if (bpm < 30) bpm = 30;
    if (bpm > 240) bpm = 240;
    
    if (isMetronomePlaying)
    {
        await JSRuntime.InvokeVoidAsync("AudioInterop.setMetronomeBpm", bpm);
    }
}

private async Task OnBpmInput(ChangeEventArgs e)
{
    if (int.TryParse(e.Value?.ToString(), out int newBpm))
    {
        bpm = newBpm;
        await OnBpmChanged();
    }
}
```

**Input Handling**:
- `@oninput`: Fires on every keystroke (real-time validation)
- `ChangeEventArgs`: Contains the raw input value
- `int.TryParse`: Safe parsing with fallback

##### d) Recording Toggle

```csharp
private async Task ToggleRecording()
{
    if (isRecording)
    {
        isRecording = false;
        await JSRuntime.InvokeVoidAsync("AudioInterop.stopRecording");
    }
    else
    {
        ResetStats();
        var success = await JSRuntime.InvokeAsync<bool>("AudioInterop.startRecording");
        if (success)
        {
            isRecording = true;
        }
    }
}
```

**Return Value Handling**:
- `InvokeAsync<bool>`: Expects JS function to return boolean
- Success check: Only set `isRecording = true` if JS confirms

#### 5. JSInvokable Methods (Callbacks from JavaScript)

```csharp
[JSInvokable]
public async Task OnPitchResult(
    double timeMs, 
    double frequencyHz,
    double centDeviation, 
    bool isInRaga, 
    string swaraName)
{
    totalNotesDetected++;
    if (isInRaga) correctNotes++;
    else mistakeCount++;

    if (totalNotesDetected > 0)
    {
        stabilityScore = Math.Round(
            (double)correctNotes / totalNotesDetected * 100, 
            1
        );
    }

    // Batch updates to avoid excessive re-renders
    if (totalNotesDetected % 5 == 0)
    {
        await InvokeAsync(StateHasChanged);
    }
}

[JSInvokable]
public async Task OnRecordingStopped(
    double stability, 
    int total, 
    int correct, 
    int mistakes)
{
    isRecording = false;
    stabilityScore = stability;
    totalNotesDetected = total;
    correctNotes = correct;
    mistakeCount = mistakes;
    await InvokeAsync(StateHasChanged);
}
```

**Callback Pattern**:
1. Mark with `[JSInvokable]` attribute
2. Must be `public` method
3. Return `Task` for async operations
4. Use `InvokeAsync(StateHasChanged)` for UI updates (marshal to Blazor's sync context)

#### 6. IDisposable Pattern

```csharp
public async ValueTask DisposeAsync()
{
    try
    {
        // Clean up audio resources
        await JSRuntime.InvokeVoidAsync("AudioInterop.stopShrutiDrone");
        await JSRuntime.InvokeVoidAsync("AudioInterop.stopMetronome");
        await JSRuntime.InvokeVoidAsync("AudioInterop.dispose");
    }
    catch (JSDisconnectedException)
    {
        // Circuit already disconnected — safe to ignore
    }
    catch (InvalidOperationException)
    {
        // Prerendering — safe to ignore
    }
    finally
    {
        dotNetRef?.Dispose();
    }
}
```

**Resource Cleanup**:
- Implements `IAsyncDisposable` for async cleanup
- Stops all audio playback
- Disposes `DotNetObjectReference` to prevent memory leaks
- Handles edge cases (disconnected circuit, prerendering)

---

### Models/CarnaticTheory.cs (Domain Models)

**Location**: `/Models/CarnaticTheory.cs`

**Purpose**: Domain models representing Carnatic music theory concepts, enums, and static catalog of musical data.

#### 1. Swara Enum

```csharp
public enum Swara
{
    Sa,   // Shadjam - fixed (achala swara)
    Ri1,  // Shuddha Rishabham
    Ri2,  // Chatushruti Rishabham (= Shuddha Gandharam)
    Ri3,  // Shatshruti Rishabham (= Sadharana Gandharam)
    Ga1,  // Shuddha Gandharam (= Chatushruti Rishabham)
    Ga2,  // Sadharana Gandharam (= Shatshruti Rishabham)
    Ga3,  // Antara Gandharam
    Ma1,  // Shuddha Madhyamam
    Ma2,  // Prati Madhyamam
    Pa,   // Panchamam - fixed (achala swara)
    Da1,  // Shuddha Dhaivatam
    Da2,  // Chatushruti Dhaivatam (= Shuddha Nishadam)
    Da3,  // Shatshruti Dhaivatam (= Kaisiki Nishadam)
    Ni1,  // Shuddha Nishadam (= Chatushruti Dhaivatam)
    Ni2,  // Kaisiki Nishadam (= Shatshruti Dhaivatam)
    Ni3   // Kakali Nishadam
}
```

**Music Theory**:
- 16 swarasthanas (note positions) in Carnatic music
- Sa and Pa are **achala** (fixed, never change)
- Other swaras have multiple variants (chala swaras)
- **Vadi-Samvadi**: Some swaras are enharmonically equivalent (Ri2 = Ga1)

#### 2. Raga Class

```csharp
public class Raga
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int MelaNumber { get; set; }
    public string Description { get; set; } = string.Empty;
    public List<Swara> Arohanam { get; set; } = new();
    public List<Swara> Avarohanam { get; set; } = new();

    // Computed property: Union of ascending/descending swaras
    public HashSet<Swara> AllowedSwaras =>
        new(Arohanam.Concat(Avarohanam));
}
```

**Properties**:
- `Name`: Internal identifier (URL-safe)
- `DisplayName`: User-friendly name with mela number
- `MelaNumber`: Melakarta number (1-72 for mela ragas)
- `Arohanam`: Ascending scale (arohanam)
- `Avarohanam`: Descending scale (avarohanam)
- `AllowedSwaras`: Computed HashSet for O(1) lookup

#### 3. Shruti Class

```csharp
public class Shruti
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public double SaFrequencyHz { get; set; }
    public double Kattai { get; set; }  // Pitch level indicator
}
```

**Kattai System**:
- 1 kattai = 1 semitone above C (C#)
- 2 kattai = 2 semitones above C (D)
- Common values: 3 (E), 3.5 (F), 4 (F#), 5 (G#), 5.5 (A)

#### 4. CarnaticCatalog (Static Service)

**Frequency Calculation**:

```csharp
public static double GetSwaraFrequency(
    Swara swara, 
    double saFrequencyHz, 
    int octaveOffset = 0)
{
    int semitones = SwaraSemitoneOffsets[swara];
    // Formula: f = Sa * 2^((semitones/12) + octave)
    return saFrequencyHz * Math.Pow(2, (semitones / 12.0) + octaveOffset);
}
```

**12-TET (Twelve-Tone Equal Temperament)**:
- Each semitone = 2^(1/12) frequency ratio
- Formula: `f = Sa × 2^((semitones/12) + octave)`
- Example: Pa (7 semitones) at Sa=130.81Hz → 130.81 × 2^(7/12) = 196.00Hz

**Swara Finding Algorithm**:

```csharp
public static (Swara swara, double centDeviation, int octaveOffset) 
    FindNearestSwara(double frequencyHz, double saFrequencyHz)
{
    // Convert frequency ratio to semitones
    double totalSemitones = 12.0 * Math.Log2(frequencyHz / saFrequencyHz);
    
    // Extract octave (integer division)
    int octaveOffset = (int)Math.Floor(totalSemitones / 12.0);
    double semitonesInOctave = totalSemitones - (octaveOffset * 12.0);
    
    // Find closest swara among 12 chromatic positions
    // Handle wraparound for Sa (0 vs 1200 cents)
    // Return nearest swara and deviation in cents
}
```

**Cents Calculation**:
- 1 semitone = 100 cents
- Deviation > 50 cents = considered "out of tune"
- Deviation > 600 cents = wrap to opposite direction

---

### Services/PitchDetector.cs (YIN Algorithm)

**Location**: `/Services/PitchDetector.cs`

**Purpose**: Pure C# implementation of the YIN pitch detection algorithm. Note: This is defined but the actual pitch detection runs in JavaScript for real-time performance.

**YIN Algorithm Steps**:

1. **Difference Function**: Compute squared differences between signal and delayed versions
   ```csharp
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
   ```

2. **Cumulative Mean Normalized Difference (CMND)**:
   ```csharp
   cmnd[tau] = difference[tau] * tau / runningSum;
   ```
   - Normalizes difference function to account for amplitude changes
   - First minimum below threshold indicates fundamental period

3. **Absolute Threshold**: Find first dip below threshold (0.15 default)
   ```csharp
   if (cmnd[tau] < _threshold)
   {
       // Found periodicity
       tauEstimate = tau;
       break;
   }
   ```

4. **Parabolic Interpolation**: Refine period estimate for sub-sample accuracy
   ```csharp
   betterTau = tauEstimate + (s2 - s0) / (2 * (2*s1 - s2 - s0));
   frequency = sampleRate / betterTau;
   ```

**Performance**:
- Time Complexity: O(n²) where n = buffer size
- Buffer size: 2048 samples (46ms at 44.1kHz)
- Designed for monophonic (single voice) detection

---

### Services/PitchAnalysisService.cs (Domain Logic)

**Location**: `/Services/PitchAnalysisService.cs`

**Purpose**: Bridges raw pitch detection with Carnatic music theory. Maps frequencies to swaras and identifies mistakes.

**Key Methods**:

#### 1. AnalyzeChunk

```csharp
public PitchDataPoint AnalyzeChunk(
    float[] audioChunk, 
    double timeMs,
    double saFrequencyHz, 
    Raga raga)
{
    // Run YIN pitch detection
    var pitchResult = _pitchDetector.DetectPitch(audioChunk);
    
    // Check for silence/noise
    if (pitchResult.Frequency <= 0 || pitchResult.Confidence < 0.5)
    {
        return new PitchDataPoint { FrequencyHz = 0, ... };
    }
    
    // Map frequency to swara
    var (nearestSwara, centDeviation, _) = CarnaticCatalog.FindNearestSwara(
        pitchResult.Frequency, saFrequencyHz);
    
    // Check if swara is in raga and in tune
    bool isInRaga = raga.AllowedSwaras.Contains(nearestSwara) &&
                    Math.Abs(centDeviation) <= DeviationThresholdCents;
    
    return new PitchDataPoint { ... };
}
```

**Logic Flow**:
1. Detect fundamental frequency
2. Filter out low-confidence results
3. Find nearest swara and deviation
4. Validate against raga scale
5. Return structured data point

#### 2. ComputeComparison

```csharp
public ComparisonResult ComputeComparison(
    List<PitchDataPoint> userPitchData, 
    Raga raga)
{
    // Filter to voiced (non-silent) points
    var voicedPoints = userPitchData.Where(
        p => p.FrequencyHz > 0 && p.Confidence >= 0.5).ToList();
    
    // Calculate stability score
    int correctNotes = voicedPoints.Count(p => p.IsInRaga);
    double stabilityScore = (double)correctNotes / voicedPoints.Count * 100;
    
    // Group contiguous mistakes
    var mistakes = new List<MistakeMarker>();
    // ... grouping logic ...
    
    return new ComparisonResult { ... };
}
```

**Mistake Grouping**:
- Contiguous errors within 200ms = single mistake
- Gaps > 200ms = new mistake region
- Provides start/end times and description

---

### wwwroot/js/audioInterop.js (Web Audio API)

**Location**: `/wwwroot/js/audioInterop.js`

**Purpose**: Handles all real-time audio operations using the Web Audio API. This is the performance-critical layer that cannot run in .NET due to WebAssembly GC overhead.

**Architecture**: Module Pattern (Singleton)

```javascript
window.AudioInterop = {
    // State
    audioContext: null,
    mediaStream: null,
    processorNode: null,
    isRecording: false,
    dotNetRef: null,
    
    // Methods
    initialize: function(dotNetRef, canvasId) { ... },
    startRecording: async function() { ... },
    // ...
};
```

#### 1. Audio Context Setup

```javascript
initialize: function(dotNetRef, canvasId) {
    this.dotNetRef = dotNetRef;
    this.canvas = document.getElementById(canvasId);
    this.canvasCtx = this.canvas.getContext('2d');
    this.resizeCanvas();
    this.drawIdleState();
}
```

**Responsibilities**:
- Store .NET callback reference
- Get canvas rendering context
- Handle responsive canvas sizing

#### 2. Microphone Recording Pipeline

```javascript
startRecording: async function() {
    // Create audio context
    this.audioContext = new AudioContext({ sampleRate: 44100 });
    
    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    });
    
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Create script processor for buffer analysis
    const bufferSize = 2048;
    this.processorNode = this.audioContext.createScriptProcessor(
        bufferSize, 1, 1);
    
    // Connect: Mic → Processor → Output (for monitoring)
    source.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
    
    // Handle audio buffers
    this.processorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const timeMs = Date.now() - this.startTime;
        
        // Run YIN pitch detection
        const result = this.detectPitch(inputData);
        
        if (result.frequency > 0 && result.confidence > 0.5) {
            const swaraResult = this.findNearestSwara(result.frequency);
            
            // Store for visualization
            this.pitchHistory.push({
                timeMs,
                frequencyHz: result.frequency,
                centDeviation: swaraResult.centDeviation,
                isInRaga: swaraResult.isInRaga,
                swaraName: swaraResult.name,
                confidence: result.confidence
            });
            
            // Send to .NET for stats (batch every 5 samples)
            if (this.dotNetRef && this.pitchHistory.length % 5 === 0) {
                this.dotNetRef.invokeMethodAsync('OnPitchResult',
                    timeMs, result.frequency, swaraResult.centDeviation,
                    swaraResult.isInRaga, swaraResult.name);
            }
        }
    };
}
```

**Signal Chain**:
```
Microphone → MediaStreamSource → ScriptProcessor → AudioDestination
                                      ↓
                                 detectPitch()
                                      ↓
                                 findNearestSwara()
                                      ↓
                                 pitchHistory[] + .NET callback
```

#### 3. Shruti Drone Generation (NEW)

```javascript
startShrutiDrone: async function(saFrequencyHz) {
    this.shrutiCtx = new AudioContext();
    const ctx = this.shrutiCtx;
    
    // Master gain (keep it subtle)
    this.shrutiGainNode = ctx.createGain();
    this.shrutiGainNode.gain.value = 0.1;
    this.shrutiGainNode.connect(ctx.destination);
    
    // Calculate Pa (perfect fifth = 3:2 ratio)
    const paFrequency = saFrequencyHz * 1.5;
    
    // Create 4 oscillators for rich drone
    const saLow = ctx.createOscillator();
    saLow.frequency.value = saFrequencyHz * 0.5;  // Lower octave
    
    const saMid = ctx.createOscillator();
    saMid.frequency.value = saFrequencyHz;  // Middle octave
    
    const pa = ctx.createOscillator();
    pa.frequency.value = paFrequency;  // Perfect fifth
    
    const saHigh = ctx.createOscillator();
    saHigh.frequency.value = saFrequencyHz * 2;  // Upper octave
    
    // Individual gain staging
    const saLowGain = ctx.createGain();
    saLowGain.gain.value = 0.5;
    const saMidGain = ctx.createGain();
    saMidGain.gain.value = 0.4;
    const paGain = ctx.createGain();
    paGain.gain.value = 0.3;
    const saHighGain = ctx.createGain();
    saHighGain.gain.value = 0.2;
    
    // Connect all to master gain
    saLow.connect(saLowGain).connect(this.shrutiGainNode);
    saMid.connect(saMidGain).connect(this.shrutiGainNode);
    pa.connect(paGain).connect(this.shrutiGainNode);
    saHigh.connect(saHighGain).connect(this.shrutiGainNode);
    
    // Start all oscillators
    saLow.start(); saMid.start(); pa.start(); saHigh.start();
    this.shrutiOscillators.push(saLow, saMid, pa, saHigh);
}
```

**Tanpura-like Sound**:
- 4 oscillators at different octaves
- Sa (low): 0.5× fundamental (deep bass)
- Sa (mid): 1.0× fundamental (root)
- Pa: 1.5× fundamental (perfect fifth)
- Sa (high): 2.0× fundamental (brightness)
- Sine waves for pure, non-harsh tone

**Stop with Fade**:
```javascript
stopShrutiDrone: function() {
    // Fade out to avoid clicks
    if (this.shrutiGainNode && this.shrutiCtx) {
        this.shrutiGainNode.gain.linearRampToValueAtTime(
            0, 
            this.shrutiCtx.currentTime + 0.1
        );
    }
    // Stop oscillators after fade
    this.shrutiOscillators.forEach(osc => {
        osc.stop(this.shrutiCtx.currentTime + 0.1);
    });
    this.shrutiCtx.close();
}
```

#### 4. Metronome Implementation (NEW)

```javascript
startMetronome: async function(beatsPerMinute) {
    this.metronomeCtx = new AudioContext();
    const intervalMs = (60 / beatsPerMinute) * 1000;
    
    const playBeat = () => {
        this.playMetronomeClick(1);
    };
    
    // Play first beat immediately
    playBeat();
    
    // Continue at regular intervals
    this.metronomeIntervalId = setInterval(playBeat, intervalMs);
}

playMetronomeClick: function(beatNumber) {
    const ctx = this.metronomeCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = beatNumber === 1 ? 1200 : 1000;  // Accented first beat
    
    // ADSR envelope for click sound
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);  // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);  // Decay
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
}
```

**ADSR Envelope**:
- **Attack**: 10ms exponential rise (instant click)
- **Decay**: 90ms exponential fall (short blip)
- **Sustain**: 0 (no sustain)
- **Release**: Instant

**Tempo Calculation**:
- BPM = Beats Per Minute
- Interval (ms) = (60 / BPM) × 1000
- Example: 60 BPM = 1000ms, 120 BPM = 500ms

#### 5. Canvas Visualization

```javascript
drawFrame: function() {
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Clear canvas
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);
    
    // Convert frequency to Y position (logarithmic scale)
    const freqToY = (f) => {
        const logMin = Math.log2(minFreq);
        const logMax = Math.log2(maxFreq);
        const logF = Math.log2(f);
        const ratio = (logF - logMin) / (logMax - logMin);
        return h - (ratio * (h - 60)) - 30;
    };
    
    // Draw swara guide lines
    this.swaraLines.forEach(swara => {
        const y = freqToY(swara.frequencyHz);
        ctx.strokeStyle = this.colors.swaraLine;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = this.colors.swaraLabel;
        ctx.fillText(swara.name, 8, y - 5);
    });
    
    // Draw user pitch line
    const visiblePoints = this.pitchHistory.filter(
        p => p.timeMs >= windowStart && p.frequencyHz > 0);
    
    for (let i = 1; i < visiblePoints.length; i++) {
        const color = visiblePoints[i].isInRaga ? 
            this.colors.pitchGood : this.colors.pitchBad;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(timeToX(prev.timeMs), freqToY(prev.frequencyHz));
        ctx.lineTo(timeToX(curr.timeMs), freqToY(curr.frequencyHz));
        ctx.stroke();
    }
    
    // Request next frame
    this.animFrameId = requestAnimationFrame(() => this.drawFrame());
}
```

**Visualization Pipeline**:
```
requestAnimationFrame (60fps)
        ↓
    drawFrame()
        ↓
Clear canvas → Draw swara lines → Draw user pitch → Draw legend
        ↓
    Loop continues
```

**Logarithmic Frequency Mapping**:
- Human pitch perception is logarithmic
- Octave = 2× frequency ratio
- Visual spacing appears even across octaves

---

### wwwroot/css/app.css (Styling)

**Location**: `/wwwroot/css/app.css`

**Purpose**: Complete styling system with CSS custom properties, dark theme, and responsive design.

#### CSS Custom Properties (Variables)

```css
:root {
    /* Background colors */
    --bg-primary: #0a0a14;      /* Main page background */
    --bg-secondary: #12121f;    /* Section backgrounds */
    --bg-card: #1a1a2e;         /* Cards, panels */
    
    /* Accent colors */
    --accent-gold: #ffb74d;     /* Primary accent */
    --accent-saffron: #ff9800;  /* Secondary accent */
    --accent-glow: rgba(255, 183, 77, 0.15);  /* Glow effects */
    
    /* Semantic colors */
    --success: #00e676;  /* Correct notes, good */
    --warning: #ffd740;  /* Slight pitch deviation */
    --danger: #ff5252;   /* Mistakes, off-pitch */
    --info: #64b5f6;     /* Information */
    
    /* Typography */
    --text-primary: #e8e8f0;
    --text-secondary: #a0a0b8;
    --text-muted: #6a6a82;
    
    /* Spacing & sizing */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    
    /* Shadows */
    --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.4);
    --shadow-glow: 0 0 30px rgba(255, 183, 77, 0.1);
}
```

**Benefits**:
- Consistent theming across app
- Easy dark mode (already dark theme)
- Single source of truth for colors

#### Responsive Grid Layout

```css
.controls-panel {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
}

.stats-panel {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}

@media (max-width: 768px) {
    .controls-panel {
        flex-direction: column;
    }
    
    .stats-panel {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

**Responsive Strategy**:
- Desktop (≥768px): 4-column stats, multi-column controls
- Mobile (<768px): 2-column stats, stacked controls
- `auto-fit` with `minmax`: Automatically wraps columns

#### Button Components

```css
.btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.2s ease;
}

.btn-record {
    background: linear-gradient(135deg, #d50000, #ff1744);
    box-shadow: 0 4px 15px rgba(213, 0, 0, 0.3);
}

.btn-record:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(213, 0, 0, 0.4);
}

.btn-drone-on {
    background: linear-gradient(135deg, #ff9800, #ffb74d);
    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
    animation: pulse-stop 1.5s infinite;
}
```

**Design System**:
- Gradient backgrounds for depth
- Subtle shadows for elevation
- Hover lift effect (translateY)
- Icon + text layout
- Disabled state handling

#### Animations

```css
@keyframes rec-pulse {
    0%, 100% {
        opacity: 1;
        box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.6);
    }
    50% {
        opacity: 0.5;
        box-shadow: 0 0 0 6px rgba(255, 82, 82, 0);
    }
}

.rec-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--danger);
    animation: rec-pulse 1s infinite;
}
```

**Animation Usage**:
- Recording indicator: Pulsing red dot
- Metronome button: Pulse in sync with tempo
- Error toast: Slide-in from right

---

## Component Lifecycle

### Blazor Component Lifecycle Events

```
App Startup
     ↓
App.razor renders
     ↓
Router matches URL to RagaTrainer.razor
     ↓
RagaTrainer.razor instantiates
     ↓
OnInitialized() - if defined
     ↓
OnParametersSet() - if parameters exist
     ↓
OnAfterRender(bool firstRender)
     ↓
┌────────────────────────────────────┐
│ If firstRender = true:             │
│ - Initialize JS audio              │
│ - Load default raga/shruti         │
│ - Set up canvas                    │
│ - isInitialized = true             │
│ - StateHasChanged()                │
└────────────────────────────────────┘
     ↓
Component waits for user interaction
     ↓
User clicks dropdown/button
     ↓
Event handler (@onclick, @bind)
     ↓
State update
     ↓
StateHasChanged()
     ↓
OnAfterRenderAsync(false)
     ↓
Component disposal (navigation away)
     ↓
DisposeAsync()
     ↓
┌────────────────────────────────────┐
│ Cleanup:                           │
│ - Stop all audio                   │
│ - Close audio contexts             │
│ - Dispose DotNetObjectReference    │
└────────────────────────────────────┘
```

---

## Data Flow Architecture

### User Recording Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     1. Microphone Input                       │
│                   (Browser MediaStream API)                   │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              2. ScriptProcessorNode.onaudioprocess            │
│                 (Buffer: 2048 samples @ 44.1kHz)              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│               3. detectPitch() - YIN Algorithm                │
│                 Input: float[] audioBuffer                    │
│                 Output: { frequency, confidence }             │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│            4. findNearestSwara() - Music Theory               │
│           Convert frequency to (swara, centDeviation)         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│          5. Store in pitchHistory[] for Visualization         │
│          Push to canvas render loop (60fps)                   │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│         6. invokeMethodAsync('OnPitchResult') - Batch         │
│              Send every 5 samples to .NET for stats           │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│     7. [JSInvokable] OnPitchResult() - Update .NET State      │
│        - Increment totalNotesDetected                         │
│        - Increment correctNotes or mistakeCount               │
│        - Recalculate stabilityScore                           │
│        - InvokeAsync(StateHasChanged()) every 5 results       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│             8. Razor Re-render - Update UI                    │
│        Stats panel shows updated scores                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Audio Processing Pipeline

### Multiple Audio Contexts

The app manages **4 independent audio contexts**:

1. **Recording Context** (`audioContext`)
   - Microphone input
   - ScriptProcessor for pitch detection
   - Lifetime: During recording only

2. **Reference Context** (`referenceCtx`)
   - Play raga arohanam/avarohanam
   - Oscillator-based tone generation
   - Lifetime: During reference playback

3. **Drone Context** (`shrutiCtx`) - NEW
   - Continuous Sa-Pa drone
   - 4 oscillators (low Sa, mid Sa, Pa, high Sa)
   - Lifetime: While drone toggle is on

4. **Metronome Context** (`metronomeCtx`) - NEW
   - Click track with adjustable BPM
   - Single oscillator with ADSR envelope
   - Lifetime: While metronome toggle is on

**Why Multiple Contexts?**
- Independent volume control
- Separate gain staging
- Can run simultaneously
- Clean disposal (close one without affecting others)

### Audio Graph: Shruti Drone

```
                    shrutiGainNode (master, gain=0.1)
                          /     |     |     \
                         /      |     |      \
                        ↓       ↓     ↓       ↓
┌────────────┐   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Sa (low)  │──→│saLowGain │ │saMidGain │ │ paGain   │ │saHighGain│
│  f×0.5     │   │ (g=0.5)  │ │ (g=0.4)  │ │ (g=0.3)  │ │ (g=0.2)  │
└────────────┘   └──────────┘ └──────────┘ └──────────┘ └──────────┘
                      ↑           ↑           ↑           ↑
                 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
                 │Sa (mid)│ │   Pa   │ │Sa (high│ │        │
                 │  f×1.0 │ │ f×1.5  │ │  f×2.0 │ │        │
                 └────────┘ └────────┘ └────────┘ └────────┘
```

### Audio Graph: Metronome

```
┌────────────┐    ┌──────┐    ┌──────────────┐
│ Oscillator │───→│ Gain │───→│ Destination  │
│ Square Wave│    │ADSR  │    │ (Speakers)   │
│ 1000-1200Hz│    └──────┘    └──────────────┘
└────────────┘
     ↑
     │
setInterval (BPM interval)
```

---

## .NET Concepts Used

### 1. Nullable Reference Types

```csharp
private Raga? selectedRaga;  // Can be null
private string errorMessage = null;  // Initialized to null, safe
```

**Benefits**:
- Compiler warnings on potential null dereference
- Self-documenting API
- Prevents NullReferenceException

### 2. Pattern Matching (Switch Expression)

```csharp
private string GetSwaraDisplayName(Swara swara) => swara switch
{
    Swara.Sa => "Sa",
    Swara.Ri1 => "Ri₁",
    Swara.Ga3 => "Ga₃",
    Swara.Pa => "Pa",
    _ => swara.ToString()  // Default case
};
```

**Benefits**:
- More concise than switch statement
- Exhaustive checking (compiler warns on missing cases)
- Expression-bodied (returns value)

### 3. Async/Await Pattern

```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    await JSRuntime.InvokeVoidAsync("AudioInterop.initialize", ...);
    await UpdateSwaraConfig();
    StateHasChanged();
}
```

**Why Async?**
- JS interop is asynchronous (crosses process boundary in WASM)
- Non-blocking UI thread
- `await` automatically marshals back to Blazor's sync context

### 4. Dependency Injection

```csharp
@inject IJSRuntime JSRuntime
@inject IJSInProcessRuntime JSInProcessRuntime
@inject PitchAnalysisService PitchService
```

**Service Lifetimes**:
- `Scoped`: One instance per browser tab (WASM)
- `Transient`: New instance every time (not used here)
- `Singleton`: Shared across all users (server-side only)

### 5. LINQ (Language Integrated Query)

```csharp
var correctNotes = voicedPoints.Count(p => p.IsInRaga);

selectedRaga = ragas.FirstOrDefault(r => r.Name == selectedRagaName);

var allFrequencies = selectedRaga.Arohanam
    .Select(s => CarnaticCatalog.GetSwaraFrequency(s, shruti.SaFrequencyHz))
    .ToList();
```

**Benefits**:
- Type-safe queries
- Deferred execution
- Readable data transformations

### 6. Events and Delegates

```csharp
@bind:after="OnRagaChanged"  // Event callback
@onclick="ToggleRecording"   // Mouse event
@oninput="OnBpmInput"        // Input event
```

**Event Handling**:
- C# events in Razor syntax
- Lambda expressions for inline handlers
- `ChangeEventArgs` for input values

### 7. Generics

```csharp
private List<Raga> ragas
private HashSet<Swara> AllowedSwaras
private DotNetObjectReference<RagaTrainer>
```

**Usage**:
- Type-safe collections
- Compiler type inference
- No boxing/unboxing

---

## Blazor-Specific Patterns

### 1. JS Interop Patterns

**a) Calling JS from .NET**
```csharp
await JSRuntime.InvokeVoidAsync("AudioInterop.startRecording");
var result = await JSRuntime.InvokeAsync<bool>("AudioInterop.checkStatus");
```

**b) Calling .NET from JS**
```csharp
// C#
dotNetRef = DotNetObjectReference.Create(this);
await JSRuntime.InvokeVoidAsync("init", dotNetRef);

// JS
dotNetRef.invokeMethodAsync('OnPitchResult', ...);
```

**c) Passing Complex Objects**
```csharp
await JSRuntime.InvokeVoidAsync("setSwaraLines", new {
    name = "Sa",
    frequencyHz = 130.81
});
```

Objects are serialized to JSON and passed across the boundary.

### 2. Component Communication

**Parent → Child (Parameters)**
```razor
<!-- Parent -->
<ChildComponent Raga="selectedRaga" />

<!-- Child -->
@attribute [Parameter] public Raga Raga { get; set; }
```

**Child → Parent (EventCallback)**
```razor
<!-- Parent -->
<ChildComponent OnRagaSelected="HandleRagaChange" />

<!-- Child -->
@attribute [Parameter] public EventCallback<Raga> OnRagaSelected { get; set; }
```

### 3. StateHasChanged

```csharp
private async Task UpdateScore()
{
    score += 10;
    StateHasChanged();  // Trigger re-render
    
    // Or after async operation:
    await SomeAsyncOperation();
    StateHasChanged();
}
```

**When to Call**:
- After async operations complete
- In event handlers that modify state
- NOT needed in regular synchronous event handlers (Blazor auto-renders)

### 4. RenderFragment

```csharp
private RenderFragment StatsCard(string label, string value) => __builder =>
{
    <div class="stat-card">
        <div class="stat-value">@value</div>
        <div class="stat-label">@label</div>
    </div>
};
```

**Usage**:
- Dynamically generated UI
- Component composition
- Reduce code duplication

### 5. EventCallback vs Action

```csharp
[Parameter] public EventCallback OnClick { get; set; }
[Parameter] public Action OnClick { get; set; }
```

**Difference**:
- `EventCallback`: Supports async, preferred
- `Action`: Synchronous only, legacy

---

## State Management

### Component State Hierarchy

```
RagaTrainer.razor (Root)
├── Application State
│   ├── isInitialized
│   ├── isRecording
│   ├── isShrutiPlaying
│   └── isMetronomePlaying
├── Music Theory State
│   ├── ragas (List<Raga>)
│   ├── shrutis (List<Shruti>)
│   ├── selectedRagaName
│   ├── selectedShrutiName
│   ├── selectedRaga
│   └── selectedShruti
├── Analytics State
│   ├── stabilityScore
│   ├── totalNotesDetected
│   ├── correctNotes
│   └── mistakeCount
└── JavaScript State
    ├── pitchHistory[] (in JS)
    ├── referencePitchHistory[] (in JS)
    └── swaraLines[] (in JS)
```

### State Synchronization: .NET ↔ JS

```csharp
// C# → JS: Send configuration
await UpdateSwaraConfig()
{
    var swaraData = ragas
        .Select(s => new { name = s.Name, frequencyHz = s.Frequency })
        .ToList();
    await JSRuntime.InvokeVoidAsync("setSwaraLines", swaraData);
}

// JS → C#: Send pitch updates
dotNetRef.invokeMethodAsync('OnPitchResult', time, freq, deviation, ...);
```

**Synchronization Strategy**:
- Configuration flows .NET → JS
- Telemetry (stats) flows JS → .NET
- Batched updates to minimize overhead

### State Update Patterns

**1. Direct Assignment + StateHasChanged**
```csharp
private void IncrementScore()
{
    score++;
    StateHasChanged();
}
```

**2. Async Update**
```csharp
private async Task LoadDefaults()
{
    selectedRaga = ragas.First();
    await UpdateConfig();
    isInitialized = true;
    StateHasChanged();
}
```

**3. Batched Updates**
```csharp
[JSInvokable]
public async Task OnPitchResult(...)
{
    totalNotesDetected++;
    
    // Only re-render every 5 results
    if (totalNotesDetected % 5 == 0)
    {
        await InvokeAsync(StateHasChanged);
    }
}
```

---

## Error Handling

### Try-Catch in Event Handlers

```csharp
private async Task ToggleShruti()
{
    try
    {
        // ... toggle logic
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error toggling shruti: {ex.Message}");
        isShrutiPlaying = false;  // Revert state
    }
}
```

### JS Interop Exception Handling

```csharp
try
{
    await JSRuntime.InvokeVoidAsync("AudioInterop.startRecording");
}
catch (JSException jsEx)
{
    // JavaScript threw an exception
    errorMessage = $"JS Error: {jsEx.Message}";
}
catch (JSDisconnectedException)
{
    // Blazor circuit disconnected (user navigated away)
    // Safe to ignore
}
catch (InvalidOperationException)
{
    // Called during prerendering (before JS is available)
    // Safe to ignore
}
```

### Error Display Component

```razor
@if (!string.IsNullOrEmpty(errorMessage))
{
    <div class="error-toast">
        <strong>Error:</strong> @errorMessage
        <button @onclick="ClearError" class="error-dismiss">Dismiss</button>
    </div>
}
```

**Logging Strategy**:
- Console.WriteLine for development
- Error toast for user-facing errors
- Silent catch for expected exceptions (disconnection)

---

## Performance Considerations

### 1. Minimize JS Interop Calls

**Bad** (too many calls):
```csharp
foreach (var swara in raga.Arohanam)
{
    await JSRuntime.InvokeVoidAsync("addSwara", swara.Name, swara.Frequency);
}
```

**Good** (batch in one call):
```csharp
var swaraData = raga.Arohanam
    .Select(s => new { name = s.Name, freq = s.Frequency })
    .ToList();
await JSRuntime.InvokeVoidAsync("setAllSwaras", swaraData);
```

### 2. Throttle State Updates

```csharp
[JSInvokable]
public async Task OnPitchResult(...)
{
    // Update stats every time
    totalNotesDetected++;
    
    // But only re-render every 5 results
    if (totalNotesDetected % 5 == 0)
    {
        await InvokeAsync(StateHasChanged);
    }
}
```

**Why**: Each `StateHasChanged` triggers a full component re-render (expensive).

### 3. Use requestAnimationFrame for Canvas

```javascript
const render = () => {
    drawFrame();
    animFrameId = requestAnimationFrame(render);
};
render();
```

**Benefits**:
- Syncs with monitor refresh rate (60fps)
- Browser can optimize render loop
- Pauses when tab is not visible (save battery)

### 4. Lazy Initialization

```csharp
protected override async Task OnAfterRenderAsync(bool firstRender)
{
    if (firstRender)
    {
        // Only initialize on first render
        await InitializeAudio();
    }
}
```

### 5. Dispose Resources

```csharp
public async ValueTask DisposeAsync()
{
    // Release microphone, close audio contexts
    await JSRuntime.InvokeVoidAsync("AudioInterop.dispose");
    
    // Prevent memory leaks
    dotNetRef?.Dispose();
}
```

### 6. WebAssembly Performance Tips

- Use `struct` for small data types (no GC overhead)
- Avoid large object allocations in hot paths
- Use `ArrayPool<T>` for buffer reuse
- Prefer `Span<T>` and `Memory<T>` for buffer manipulation

---

## Summary: Distributed System View

This application is a **single-page Blazor WebAssembly app** that demonstrates the following architectural patterns:

1. **Client-Side Only**: No backend server; runs entirely in browser
2. **Inter-Op Bridge**: C# ↔ JavaScript boundary for performance-critical code
3. **Event-Driven**: User actions trigger state updates and JS calls
4. **Real-Time Processing**: Audio pipeline with <50ms latency
5. **Component-Based**: Razor components with lifecycle management
6. **Dependency Injection**: Services injected via DI container
7. **Reactive UI**: State changes trigger reactive re-renders

**Technology Choices Rationale**:

| Requirement | Solution | Why |
|------------|----------|-----|
| Real-time audio | Web Audio API (JS) | Native browser API, low latency |
| Pitch detection | YIN in JS | WASM GC overhead too high for hot path |
| UI & state | Blazor | Type-safe, reactive, component-based |
| Music theory | C# | Strong typing, enums, pattern matching |
| Deployment | GitHub Pages | Static hosting, free, simple CI/CD |

**Trade-offs**:

✅ **Pros**:
- Type-safe domain models (C#)
- Real-time audio performance (JS)
- Declarative UI (Razor)
- Cross-platform (runs in any modern browser)

⚠️ **Cons**:
- Large initial download (~2MB WASM runtime)
- JS interop overhead for frequent calls
- Limited to browser audio APIs (no native drivers)

---

## Conclusion

The Carnatic Raga Trainer exemplifies a modern Blazor WebAssembly architecture:

- **Separation of Concerns**: Clear boundaries between UI (Razor), domain logic (C# services), and performance-critical code (JS)
- **Reactive Programming**: State changes automatically trigger UI updates
- **Type Safety**: C# enums and classes prevent music theory errors
- **Real-Time**: Sub-50ms audio processing pipeline
- **Component-Based**: Reusable, testable UI components
- **Cross-Platform**: Runs on any device with a modern browser

The architecture successfully balances the need for high-performance audio processing (in JavaScript) with the productivity and type-safety of C# for domain logic and UI.