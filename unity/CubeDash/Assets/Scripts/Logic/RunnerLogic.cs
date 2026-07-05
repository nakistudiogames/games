using System;
using System.Collections.Generic;
using System.Linq;

namespace CubeDash.Logic
{
    // Direct port of games/cube-dash/src/logic/runner.ts. All values are in the
    // web version's pixel space: 720x1280 canvas, y grows DOWNWARD, ground at
    // y=1000. The Unity view layer converts to y-up once; logic stays identical
    // so behavior — and the tests — match the Phaser build number for number.

    public enum ObstacleKind { Spike, Block, Saw, Pit, Swing, Laser }

    public sealed class Runner
    {
        /// <summary>Bottom edge of the player square.</summary>
        public double Y;
        public double Vy;
        public bool Grounded;
        /// <summary>The one air jump (double-jump power-up) spent this airtime.</summary>
        public bool AirJumpUsed;
    }

    public sealed class Obstacle
    {
        /// <summary>Left edge in world pixels (scrolls toward the player).</summary>
        public double X;
        public double W;
        public double H;
        /// <summary>Bottom edge's height above the ground: 0 = grounded, >0 = floating.</summary>
        public double Elev;
        public ObstacleKind Kind;
        /// <summary>Bob-cycle offset for Swing obstacles (from the level rng).</summary>
        public double Phase;
    }

    public readonly struct PatternObstacle
    {
        public readonly double Dx, W, H, Elev;
        public readonly ObstacleKind Kind;

        public PatternObstacle(double dx, double w, double h, ObstacleKind kind, double elev = 0)
        {
            Dx = dx; W = w; H = h; Kind = kind; Elev = elev;
        }
    }

    public sealed class Pattern
    {
        public string Id = "";
        public PatternObstacle[] Obstacles = Array.Empty<PatternObstacle>();
        /// <summary>Total footprint used for spacing to the next pattern.</summary>
        public double Width;
        /// <summary>Patterns needing longer jumps unlock at higher scroll speeds.</summary>
        public double MinSpeed;
        /// <summary>Patterns built on later worlds' obstacle kinds unlock there.</summary>
        public int MinLevel = 1;
    }

    public enum PowerUpKind { DoubleJump }

    public sealed class PowerUp
    {
        /// <summary>Center of the pickup, in world pixels.</summary>
        public double X, Y;
        public PowerUpKind Kind;
    }

    public static class RunnerLogic
    {
        public const double GROUND_Y = 1000;
        public const double PLAYER_SIZE = 60;
        /// <summary>Left edge of the player square.</summary>
        public const double PLAYER_X = 180;

        public const double GRAVITY = 6000;        // px/s²
        public const double JUMP_VELOCITY = -1550; // px/s

        public const double BASE_SPEED = 420; // px/s
        public const double MAX_SPEED = 600;

        /// <summary>Total airtime of a full jump from flat ground.</summary>
        public const double JUMP_AIRTIME_SEC = 2 * -JUMP_VELOCITY / GRAVITY;

        public const double LEVEL_SPEED_STEP = 40;
        public const int LEVELS_PER_WORLD = 5;
        private const double BASE_LEVEL_DURATION_SEC = 30;
        private const double DURATION_STEP_SEC = 15;

        public const double POWERUP_SIZE = 56;

        // Swing mines bob as a pure function of x: deterministic, memorizable.
        // Range [10, 130] is always clearable: ≤120 jumpable over, ≥80 run-under.
        public const double SWING_MID = 70;
        public const double SWING_AMP = 60;
        public const double SWING_FREQ = 2 * Math.PI / 500;

        public static double LevelDurationSec(int level) =>
            BASE_LEVEL_DURATION_SEC +
            DURATION_STEP_SEC * ((Math.Max(1, level) - 1) / LEVELS_PER_WORLD);

        public static double LevelLengthM(int level) =>
            Math.Round(LevelSpeed(level) * LevelDurationSec(level) / 10);

        /// <summary>Deterministic seed per level — same formula as the web build.</summary>
        public static uint LevelSeed(int level) => (uint)(level * 7919);

        public static double LevelSpeed(int level) =>
            Math.Min(MAX_SPEED, BASE_SPEED + (level - 1) * LEVEL_SPEED_STEP);

        public static double LevelGapScale(int level) =>
            Math.Max(0.75, 1.2 - 0.06 * (level - 1));

        /// <summary>Accent color per WORLD: teal, green, orange, cycling.</summary>
        public static readonly uint[] LEVEL_COLORS = { 0x4dd0e1, 0x66bb6a, 0xff7043 };

        public static uint LevelColor(int level) =>
            LEVEL_COLORS[(Math.Max(1, level) - 1) / LEVELS_PER_WORLD % LEVEL_COLORS.Length];

        /// <summary>Level at which each obstacle kind first appears: +1 per world.</summary>
        public static int KindUnlockLevel(ObstacleKind kind) => kind switch
        {
            ObstacleKind.Spike => 1,
            ObstacleKind.Block => 1,
            ObstacleKind.Saw => 1 + LEVELS_PER_WORLD,      // world 2
            ObstacleKind.Pit => 1 + LEVELS_PER_WORLD * 2,  // world 3
            ObstacleKind.Swing => 1 + LEVELS_PER_WORLD * 3, // world 4
            ObstacleKind.Laser => 1 + LEVELS_PER_WORLD * 4, // world 5
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };

        public static ObstacleKind[] ObstacleKindsForLevel(int level) =>
            ((ObstacleKind[])Enum.GetValues(typeof(ObstacleKind)))
            .Where(k => KindUnlockLevel(k) <= level)
            .ToArray();

        public static double SwingElev(Obstacle o) =>
            SWING_MID + SWING_AMP * Math.Sin(o.X * SWING_FREQ + o.Phase);

        public static double JumpDistancePx(double speed) => speed * JUMP_AIRTIME_SEC;

        /// <summary>Grounded jump always works; one extra air jump while boosted.
        /// Returns "ground", "air", or null.</summary>
        public static string TryJump(Runner r, bool allowAirJump)
        {
            if (r.Grounded)
            {
                r.Vy = JUMP_VELOCITY;
                r.Grounded = false;
                return "ground";
            }
            if (allowAirJump && !r.AirJumpUsed)
            {
                r.Vy = JUMP_VELOCITY;
                r.AirJumpUsed = true;
                return "air";
            }
            return null;
        }

        public static void Jump(Runner r) => TryJump(r, false);

        /// <summary>The surface the player would land on at its current x.</summary>
        public static double SupportAt(double bottomY, IReadOnlyList<Obstacle> obstacles)
        {
            double support = GROUND_Y;
            foreach (var o in obstacles)
            {
                if (o.Kind != ObstacleKind.Block) continue;
                double top = GROUND_Y - o.Elev - o.H;
                bool overlapsX = PLAYER_X + PLAYER_SIZE > o.X && PLAYER_X < o.X + o.W;
                if (overlapsX && bottomY <= top + 8) support = Math.Min(support, top);
            }
            return support;
        }

        /// <summary>Advances physics one frame. Lands on `support` when falling through it.</summary>
        public static void StepRunner(Runner r, double dtSec, double support)
        {
            if (r.Grounded && r.Y < support - 0.5)
            {
                // The surface under the player dropped away (walked off a block).
                r.Grounded = false;
            }
            if (r.Grounded) return;
            r.Vy += GRAVITY * dtSec;
            double newY = r.Y + r.Vy * dtSec;
            if (r.Vy > 0 && newY >= support)
            {
                r.Y = support;
                r.Vy = 0;
                r.Grounded = true;
                r.AirJumpUsed = false;
            }
            else
            {
                r.Y = newY;
            }
        }

        /// <summary>
        /// True when the player fatally overlaps an obstacle. Spikes have inset
        /// hitboxes; blocks kill only from the side; floating obstacles only in
        /// their band; saws/swings are circles; pits only at ground level;
        /// lasers on any beam overlap.
        /// </summary>
        public static bool CheckDeath(double bottomY, IReadOnlyList<Obstacle> obstacles)
        {
            double pl = PLAYER_X;
            double pr = PLAYER_X + PLAYER_SIZE;
            double pt = bottomY - PLAYER_SIZE;
            foreach (var o in obstacles)
            {
                if (o.Kind == ObstacleKind.Pit)
                {
                    const double inset = 22;
                    if (bottomY >= GROUND_Y - 2 && pr > o.X + inset && pl < o.X + o.W - inset)
                        return true;
                    continue;
                }
                if (o.Kind == ObstacleKind.Saw || o.Kind == ObstacleKind.Swing)
                {
                    double elev = o.Kind == ObstacleKind.Swing ? SwingElev(o) : o.Elev;
                    double r = o.W / 2 - (o.Kind == ObstacleKind.Saw ? 8 : 6);
                    double cx = o.X + o.W / 2;
                    double cy = GROUND_Y - elev - o.H / 2;
                    double nx = Math.Max(pl, Math.Min(cx, pr));
                    double ny = Math.Max(pt, Math.Min(cy, bottomY));
                    if ((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < r * r) return true;
                    continue;
                }
                double top = GROUND_Y - o.Elev - o.H;
                double bottom = GROUND_Y - o.Elev;
                if (o.Kind == ObstacleKind.Laser)
                {
                    const double inset = 6;
                    if (pr > o.X + inset && pl < o.X + o.W - inset &&
                        bottomY > top + 6 && pt < bottom)
                        return true;
                }
                else if (o.Kind == ObstacleKind.Spike)
                {
                    const double inset = 16;
                    if (pr > o.X + inset && pl < o.X + o.W - inset &&
                        bottomY > top + 12 && pt < bottom - 12)
                        return true;
                }
                else // Block
                {
                    if (pr > o.X && pl < o.X + o.W && bottomY > top + 8 && pt < bottom - 4)
                        return true;
                }
            }
            return false;
        }

        // Same entries, same ORDER as the web PATTERNS array — Rng.Pick indexes
        // into the filtered list, so ordering is part of layout determinism.
        public static readonly Pattern[] PATTERNS =
        {
            new() { Id = "spike1", Obstacles = new[] { new PatternObstacle(0, 60, 60, ObstacleKind.Spike) }, Width = 60, MinSpeed = 0 },
            new() { Id = "spike2", Obstacles = new[]
                {
                    new PatternObstacle(0, 60, 60, ObstacleKind.Spike),
                    new PatternObstacle(60, 60, 60, ObstacleKind.Spike),
                }, Width = 120, MinSpeed = 0 },
            new() { Id = "spike3", Obstacles = new[]
                {
                    new PatternObstacle(0, 60, 60, ObstacleKind.Spike),
                    new PatternObstacle(60, 60, 60, ObstacleKind.Spike),
                    new PatternObstacle(120, 60, 60, ObstacleKind.Spike),
                }, Width = 180, MinSpeed = 540 },
            new() { Id = "blockLow", Obstacles = new[] { new PatternObstacle(0, 120, 60, ObstacleKind.Block) }, Width = 120, MinSpeed = 0 },
            new() { Id = "blockTall", Obstacles = new[] { new PatternObstacle(0, 90, 120, ObstacleKind.Block) }, Width = 90, MinSpeed = 0 },
            new() { Id = "spikeGapSpike", Obstacles = new[]
                {
                    new PatternObstacle(0, 60, 60, ObstacleKind.Spike),
                    new PatternObstacle(300, 60, 60, ObstacleKind.Spike),
                }, Width = 360, MinSpeed = 0 },
            new() { Id = "stairs", Obstacles = new[]
                {
                    new PatternObstacle(0, 90, 60, ObstacleKind.Block),
                    new PatternObstacle(90, 90, 120, ObstacleKind.Block),
                }, Width = 180, MinSpeed = 460 },
            new() { Id = "tunnel", Obstacles = new[]
                {
                    new PatternObstacle(0, 240, 60, ObstacleKind.Block, 90),
                    new PatternObstacle(360, 60, 60, ObstacleKind.Spike),
                }, Width = 420, MinSpeed = 500 },
            new() { Id = "airMine", Obstacles = new[] { new PatternObstacle(0, 54, 54, ObstacleKind.Spike, 110) }, Width = 54, MinSpeed = 500 },
            new() { Id = "skyway", Obstacles = new[]
                {
                    new PatternObstacle(0, 240, 30, ObstacleKind.Block, 120),
                    new PatternObstacle(60, 120, 60, ObstacleKind.Spike),
                    new PatternObstacle(180, 120, 60, ObstacleKind.Spike),
                }, Width = 320, MinSpeed = 540 },
            new() { Id = "mineCombo", Obstacles = new[]
                {
                    new PatternObstacle(0, 60, 60, ObstacleKind.Spike),
                    new PatternObstacle(210, 54, 54, ObstacleKind.Spike, 130),
                }, Width = 264, MinSpeed = 580 },
            new() { Id = "saw1", Obstacles = new[] { new PatternObstacle(0, 90, 90, ObstacleKind.Saw) }, Width = 90, MinSpeed = 0, MinLevel = 6 },
            new() { Id = "sawSpike", Obstacles = new[]
                {
                    new PatternObstacle(0, 90, 90, ObstacleKind.Saw),
                    new PatternObstacle(390, 60, 60, ObstacleKind.Spike),
                }, Width = 450, MinSpeed = 0, MinLevel = 8 },
            new() { Id = "pit1", Obstacles = new[] { new PatternObstacle(0, 150, 24, ObstacleKind.Pit) }, Width = 150, MinSpeed = 0, MinLevel = 11 },
            new() { Id = "pitSaw", Obstacles = new[]
                {
                    new PatternObstacle(0, 150, 24, ObstacleKind.Pit),
                    new PatternObstacle(450, 90, 90, ObstacleKind.Saw),
                }, Width = 540, MinSpeed = 0, MinLevel = 13 },
            new() { Id = "swing1", Obstacles = new[] { new PatternObstacle(0, 54, 54, ObstacleKind.Swing) }, Width = 54, MinSpeed = 0, MinLevel = 16 },
            new() { Id = "swingPit", Obstacles = new[]
                {
                    new PatternObstacle(0, 54, 54, ObstacleKind.Swing),
                    new PatternObstacle(330, 150, 24, ObstacleKind.Pit),
                }, Width = 480, MinSpeed = 0, MinLevel = 18 },
            new() { Id = "laser1", Obstacles = new[] { new PatternObstacle(0, 24, 130, ObstacleKind.Laser) }, Width = 24, MinSpeed = 0, MinLevel = 21 },
            new() { Id = "laserRow", Obstacles = new[]
                {
                    new PatternObstacle(0, 24, 130, ObstacleKind.Laser),
                    new PatternObstacle(420, 24, 130, ObstacleKind.Laser),
                }, Width = 444, MinSpeed = 0, MinLevel = 23 },
        };

        public static Pattern PickPattern(Mulberry32 rng, double speed, int level)
        {
            var available = PATTERNS.Where(p => p.MinSpeed <= speed && p.MinLevel <= level).ToArray();
            return rng.Pick(available);
        }

        /// <summary>Breathing room between patterns: reaction time plus one full jump.</summary>
        public static double MinGapPx(double speed) => 0.5 * speed + JumpDistancePx(speed);

        /// <summary>Pickups float within single-jump reach (apex ≈ 200px above ground).</summary>
        public static PowerUp MakePowerUp(Mulberry32 rng, double x) => new()
        {
            X = x,
            Y = GROUND_Y - 90 - rng.Next() * 90,
            Kind = PowerUpKind.DoubleJump,
        };

        /// <summary>World-pixel gap between pickup spawns.</summary>
        public static double PowerUpGapPx(Mulberry32 rng) => 2400 + rng.Next() * 1600;

        public static bool CollectsPowerUp(double bottomY, PowerUp p)
        {
            const double half = POWERUP_SIZE / 2;
            return PLAYER_X + PLAYER_SIZE > p.X - half &&
                   PLAYER_X < p.X + half &&
                   bottomY > p.Y - half &&
                   bottomY - PLAYER_SIZE < p.Y + half;
        }
    }
}
