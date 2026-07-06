using System;
using System.Collections.Generic;
using System.Linq;

namespace CubeDash.Logic
{
    /// <summary>One placement inside a chunk; Dx from the chunk's left edge.</summary>
    public sealed class ChunkOb
    {
        public float Dx, W, H, Y;
        public ObKind Kind;

        public ChunkOb(float dx, float w, float h, ObKind kind, float y = 0)
        {
            Dx = dx; W = w; H = h; Kind = kind; Y = y;
        }
    }

    /// <summary>A hand-authored obstacle group. Tier gates difficulty:
    /// higher tiers only appear on later levels.</summary>
    public sealed class Chunk
    {
        public string Id = "";
        public int Tier;
        public float Width;
        public ChunkOb[] Obs = Array.Empty<ChunkOb>();
        /// <summary>Ground hole inside the chunk (relative start), if any.</summary>
        public float GapStart = -1;
        public float GapWidth;
        public bool HasGap => GapStart >= 0;
    }

    /// <summary>A fully built level: fixed geometry, identical every attempt.</summary>
    public sealed class LevelLayout
    {
        public readonly List<Ob> Obs = new();
        public readonly List<Gap> Gaps = new();
        public float LengthPx;
        public readonly List<string> ChunkIds = new();
    }

    public static class Chunks
    {
        // ------------------------------------------------------------------
        // Level parameters (new tuning — not the web game's).

        public const float BaseSpeed = 410;
        public const float SpeedStep = 28;
        public const float MaxSpeed = 640;
        public const float OpeningRunwayPx = 900;
        public const float FinishRunwayPx = 1400;

        public static float LevelSpeed(int level) =>
            Math.Min(MaxSpeed, BaseSpeed + SpeedStep * (Math.Max(1, level) - 1));

        /// <summary>~30s runs, +8s per world.</summary>
        public static float LevelDurationSec(int level) =>
            30 + 8 * ((Math.Max(1, level) - 1) / WorldData.LEVELS_PER_WORLD);

        public static float LevelLengthPx(int level) =>
            LevelSpeed(level) * LevelDurationSec(level);

        public static uint LevelSeed(int level) => (uint)level * 0x9E3779B9u;

        /// <summary>Highest chunk tier available: 0 on levels 1-2, then +1
        /// every two levels (tier 3 from level 7).</summary>
        public static int MaxTier(int level) => Math.Min(3, (Math.Max(1, level) - 1) / 2);

        /// <summary>Breathing room between chunks: reaction + landing space,
        /// tightening on later levels but never below a safe floor.</summary>
        public static float PadPx(int level)
        {
            float speed = LevelSpeed(level);
            float scale = Math.Max(0.8f, 1.15f - 0.035f * (level - 1));
            return (speed * 0.5f + Sim.JumpDistance(speed) * 0.55f) * scale;
        }

        /// <summary>Accent per world: teal, green, orange (matches the web art).</summary>
        public static readonly uint[] WORLD_ACCENTS = { 0x4dd0e1, 0x66bb6a, 0xff7043 };

        public static uint AccentForLevel(int level) =>
            WORLD_ACCENTS[(WorldData.WorldNumberForLevel(level) - 1) % WORLD_ACCENTS.Length];

        // ------------------------------------------------------------------
        // Chunk library. Widths/heights chosen against the Sim constants:
        // jump apex ≈ 216, jump distance 237 (L1) → 369 (max speed).

        public static readonly Chunk[] LIBRARY =
        {
            // --- tier 0: singles, from level 1 ---
            new() { Id = "spike1", Tier = 0, Width = 60,
                Obs = new[] { new ChunkOb(0, 60, 60, ObKind.Spike) } },
            new() { Id = "spike2", Tier = 0, Width = 120,
                Obs = new[]
                {
                    new ChunkOb(0, 60, 60, ObKind.Spike),
                    new ChunkOb(60, 60, 60, ObKind.Spike),
                } },
            new() { Id = "box", Tier = 0, Width = 110,
                Obs = new[] { new ChunkOb(0, 110, 65, ObKind.Block) } },
            new() { Id = "boxTall", Tier = 0, Width = 95,
                Obs = new[] { new ChunkOb(0, 95, 130, ObKind.Block) } },
            new() { Id = "spikeSplit", Tier = 0, Width = 360,
                Obs = new[]
                {
                    new ChunkOb(0, 60, 60, ObKind.Spike),
                    new ChunkOb(300, 60, 60, ObKind.Spike),
                } },

            // --- tier 1: from level 3 ---
            new() { Id = "saw1", Tier = 1, Width = 92,
                Obs = new[] { new ChunkOb(0, 92, 92, ObKind.Saw) } },
            new() { Id = "stairs", Tier = 1, Width = 180,
                Obs = new[]
                {
                    new ChunkOb(0, 90, 65, ObKind.Block),
                    new ChunkOb(90, 90, 130, ObKind.Block),
                } },
            new() { Id = "gapS", Tier = 1, Width = 150, GapStart = 0, GapWidth = 150 },
            new() { Id = "sawSpike", Tier = 1, Width = 420,
                Obs = new[]
                {
                    new ChunkOb(0, 92, 92, ObKind.Saw),
                    new ChunkOb(360, 60, 60, ObKind.Spike),
                } },

            // --- tier 2: from level 5 ---
            new() { Id = "mineOver", Tier = 2, Width = 264,
                Obs = new[]
                {
                    new ChunkOb(0, 60, 60, ObKind.Spike),
                    // Mine floats over the landing zone: jump EARLY.
                    new ChunkOb(210, 54, 54, ObKind.Mine, 120),
                } },
            new() { Id = "skyway", Tier = 2, Width = 290,
                Obs = new[]
                {
                    // Ride the slab across the spike pit, hop off the end.
                    new ChunkOb(0, 240, 26, ObKind.Slab, 140),
                    new ChunkOb(50, 60, 60, ObKind.Spike),
                    new ChunkOb(150, 60, 60, ObKind.Spike),
                } },
            new() { Id = "gapM", Tier = 2, Width = 190, GapStart = 0, GapWidth = 190 },
            new() { Id = "beam1", Tier = 2, Width = 26,
                Obs = new[] { new ChunkOb(0, 26, 135, ObKind.Beam) } },
            new() { Id = "sawGap", Tier = 2, Width = 482, GapStart = 0, GapWidth = 150,
                Obs = new[] { new ChunkOb(390, 92, 92, ObKind.Saw) } },

            // --- tier 3: from level 7 ---
            new() { Id = "sawPair", Tier = 3, Width = 392,
                Obs = new[]
                {
                    new ChunkOb(0, 92, 92, ObKind.Saw),
                    new ChunkOb(300, 92, 92, ObKind.Saw),
                } },
            new() { Id = "gapMine", Tier = 3, Width = 404, GapStart = 0, GapWidth = 170,
                Obs = new[] { new ChunkOb(350, 54, 54, ObKind.Mine, 130) } },
            new() { Id = "beamRow", Tier = 3, Width = 406,
                Obs = new[]
                {
                    new ChunkOb(0, 26, 135, ObKind.Beam),
                    new ChunkOb(380, 26, 135, ObKind.Beam),
                } },
            new() { Id = "gapWide", Tier = 3, Width = 230, GapStart = 0, GapWidth = 230 },
            new() { Id = "spike3", Tier = 3, Width = 180,
                Obs = new[]
                {
                    new ChunkOb(0, 60, 60, ObKind.Spike),
                    new ChunkOb(60, 60, 60, ObKind.Spike),
                    new ChunkOb(120, 60, 60, ObKind.Spike),
                } },
        };

        /// <summary>The level a tier first appears on (inverse of MaxTier).</summary>
        public static int TierUnlockLevel(int tier) => tier * 2 + 1;

        /// <summary>Builds the whole level up front: deterministic, memorizable,
        /// identical every attempt.</summary>
        public static LevelLayout Build(int level)
        {
            var rng = new Mulberry32(LevelSeed(level));
            var layout = new LevelLayout { LengthPx = LevelLengthPx(level) };
            int maxTier = MaxTier(level);
            var eligible = LIBRARY.Where(c => c.Tier <= maxTier).ToArray();
            float pad = PadPx(level);

            float cursor = OpeningRunwayPx;
            while (true)
            {
                var chunk = rng.Pick(eligible);
                if (cursor + chunk.Width > layout.LengthPx - FinishRunwayPx) break;
                layout.ChunkIds.Add(chunk.Id);
                foreach (var co in chunk.Obs)
                    layout.Obs.Add(new Ob
                    {
                        X = cursor + co.Dx, W = co.W, H = co.H, Y = co.Y, Kind = co.Kind,
                    });
                if (chunk.HasGap)
                    layout.Gaps.Add(new Gap(cursor + chunk.GapStart, cursor + chunk.GapStart + chunk.GapWidth));
                cursor += chunk.Width + pad;
            }
            return layout;
        }
    }
}
