Carnatic Raga Trainer
The Carnatic Raga Trainer is a real-time pitch visualization and practice tool designed for students of Carnatic music. It allows users to capture audio via their microphone, analyze their pitch against specific ragas, and receive instant feedback on their performance.

🚀 Key Features
Real-Time Pitch Tracking: Visualizes pitch trajectory on an HTML5 Canvas with sub-50ms latency.
Carnatic Theory Integration: Supports multiple ragas (including the 72 Melakarta system) and "Kattai" (tonic) selection.
Practice Tools: Includes a continuous Sa-Pa-Sa Shruti drone (Tanpura-like sound) and a customizable metronome with an adjustable BPM.
Reference Playback: Play raga arohanam and avarohanam scales using oscillator-based tones.
Performance Analytics: Provides stability scores, note detection, and mistake identification.

🛠️ Technology Stack
Frontend Framework: .NET 8 & Blazor WebAssembly (runs entirely in the browser).
Logic: C# 12 for complex music theory and domain models.
Audio Engine: JavaScript (ES6+) utilizing the Web Audio API and the YIN algorithm for high-performance pitch detection.
Visualization: HTML5 Canvas for 60fps rendering.
Deployment: Static hosting via GitHub Pages.

🏗️ Architecture Summary
The application follows a layered architecture to ensure a clean separation of concerns:
Presentation Layer: Razor Components for a reactive UI.
Service Layer: Bridges raw frequency data with musical theory.
Domain Layer: Encapsulates Carnatic music concepts like Swaras and Ragas.
Infrastructure Layer: Uses JavaScript Interop to handle performance-critical audio processing and visualization, avoiding WebAssembly garbage collection overhead.

🎹 How It Works
The app manages four independent audio contexts—Recording, Reference, Drone, and Metronome—to allow for independent volume control and clean resource disposal. While the UI and theory are managed in C#, the "hot path" of 60fps audio/visual processing is handled in JavaScript to maintain real-time performance
