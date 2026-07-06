using System;

namespace CubeDash.Logic
{
    // Direct port of games/cube-dash/src/worlds.ts: every 5 levels share a
    // theme (palette + silhouette + 16-step music pattern), cycling.

    public enum SilhouetteStyle { City, Crystals, Rocks }

    public sealed class MusicPattern
    {
        public double Bpm;
        /// <summary>16 steps each; note frequency in Hz, or null for a rest.</summary>
        public double?[] Bass = Array.Empty<double?>();
        public double?[] Lead = Array.Empty<double?>();
        public bool[] Kick = Array.Empty<bool>();
        public bool[] Hat = Array.Empty<bool>();
    }

    public sealed class WorldTheme
    {
        public string Id = "";
        public string Name = "";
        public uint SkyTop, SkyBottomA, SkyBottomB, Haze, SilDark, SilLight;
        public SilhouetteStyle Silhouette;
        public uint GroundBase, GroundGrid;
        public MusicPattern Music = new();
    }

    public static class WorldData
    {
        /// <summary>Levels per world theme before cycling to the next.</summary>
        public const int LEVELS_PER_WORLD = 5;

        // Note frequencies (Hz) — same tables as the web build.
        private const double E2 = 82.41, G2 = 98.0, A2 = 110.0, C3 = 130.81;
        private const double D2 = 73.42, F2 = 87.31, BB2 = 116.54;
        private const double G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33;
        private const double E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.0;
        private const double BB5 = 932.33, B5 = 987.77, C6 = 1046.5, DB6 = 1108.73;

        private static double?[] N(params double?[] xs) => xs;

        public static readonly WorldTheme[] WORLDS =
        {
            new()
            {
                Id = "city", Name = "Neon City",
                SkyTop = 0x0b0e24, SkyBottomA = 0x2a1650, SkyBottomB = 0x1a1240,
                Haze = 0x2a1650, SilDark = 0x181f38, SilLight = 0x232c4e,
                Silhouette = SilhouetteStyle.City,
                GroundBase = 0x10142a, GroundGrid = 0x1c2547,
                // Driving A-minor electro, 132 BPM.
                Music = new MusicPattern
                {
                    Bpm = 132,
                    Bass = N(A2, null, A2, null, C3, null, C3, null, G2, null, G2, null, E2, null, E2, C3),
                    Lead = N(A4, null, C5, null, E5, null, A5, null, G4, null, C5, null, E5, null, C5, A4),
                    Kick = new[] { true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false },
                    Hat = new[] { false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true },
                },
            },
            new()
            {
                Id = "caves", Name = "Crystal Caves",
                SkyTop = 0x061a1c, SkyBottomA = 0x0d3a3f, SkyBottomB = 0x0a2d38,
                Haze = 0x0d3a3f, SilDark = 0x0f2f33, SilLight = 0x1c4d52,
                Silhouette = SilhouetteStyle.Crystals,
                GroundBase = 0x0a2023, GroundGrid = 0x14424a,
                // Airy D-minor drift, 112 BPM — sparser and calmer.
                Music = new MusicPattern
                {
                    Bpm = 112,
                    Bass = N(D2, null, null, null, F2, null, null, null, A2, null, null, null, F2, null, D2, null),
                    Lead = N(D5, null, null, F5, null, null, A5, null, null, E5, null, null, F5, null, null, null),
                    Kick = new[] { true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false },
                    Hat = new[] { false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false },
                },
            },
            new()
            {
                Id = "magma", Name = "Magma Core",
                SkyTop = 0x1a0705, SkyBottomA = 0x571e0a, SkyBottomB = 0x3a1206,
                Haze = 0x571e0a, SilDark = 0x2b100a, SilLight = 0x572317,
                Silhouette = SilhouetteStyle.Rocks,
                GroundBase = 0x200b06, GroundGrid = 0x4d2012,
                // Evil E-Phrygian dirge, 138 BPM: E→F grind, tritone stabs,
                // diminished lead with a chromatic descending tail.
                Music = new MusicPattern
                {
                    Bpm = 138,
                    Bass = N(E2, null, E2, F2, E2, null, BB2, null, E2, null, E2, F2, C3, null, BB2, null),
                    Lead = N(E5, null, null, BB5, null, null, G5, null, F5, null, null, DB6, null, C6, B5, null),
                    Kick = new[] { true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, false },
                    Hat = new[] { false, false, true, false, false, false, true, false, false, false, true, false, false, true, false, true },
                },
            },
        };

        /// <summary>1-based world number for a level (world 1 = levels 1-5, ...).</summary>
        public static int WorldNumberForLevel(int level) =>
            (Math.Max(1, level) - 1) / LEVELS_PER_WORLD + 1;

        public static WorldTheme ForLevel(int level) =>
            WORLDS[(WorldNumberForLevel(level) - 1) % WORLDS.Length];
    }
}
