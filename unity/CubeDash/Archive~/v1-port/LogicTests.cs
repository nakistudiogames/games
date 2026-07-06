using System.Linq;
using CubeDash.Logic;
using NUnit.Framework;
using static CubeDash.Logic.RunnerLogic;

namespace CubeDash.Tests
{
    // Port of the core of games/cube-dash/test/runner.test.ts, plus parity
    // suites proving the C# rng/layouts match the web build exactly.

    public class RngParityTests
    {
        // Reference values generated from the TS mulberry32
        // (packages/core/src/rng.ts) — see docs/unity-compare-setup.md.
        [Test]
        public void MatchesWebMulberry32Exactly()
        {
            AssertSequence(7919, new[]
            {
                0.69009949848987162, 0.74164396990090609, 0.37708328501321375,
                0.80804109387099743, 0.24781381688080728,
            });
            AssertSequence(55433, new[]
            {
                0.64285103697329760, 0.33535966463387012, 0.87372896191664040,
                0.33702875510789454, 0.75740567082539201,
            });
            AssertSequence(1, new[]
            {
                0.62707394058816135, 0.00273572118021548, 0.52744703995995224,
                0.98105096747167408, 0.96837789821438491,
            });
        }

        private static void AssertSequence(uint seed, double[] expected)
        {
            var rng = new Mulberry32(seed);
            foreach (double e in expected)
                Assert.That(rng.Next(), Is.EqualTo(e).Within(1e-16), $"seed {seed}");
        }

        // First 8 pattern ids per level, computed with the web implementation.
        // Same seeds + same filtered pattern order => identical level layouts.
        [TestCase(1, "blockTall,blockTall,spike2,spikeGapSpike,spike2,blockTall,spike1,spike2")]
        [TestCase(12, "saw1,stairs,stairs,spike2,sawSpike,blockLow,blockLow,tunnel")]
        [TestCase(21, "spikeGapSpike,spikeGapSpike,blockTall,spike2,blockTall,saw1,spike3,skyway")]
        public void LevelLayoutsMatchWebBuild(int level, string expectedIds)
        {
            var rng = new Mulberry32(LevelSeed(level));
            string ids = string.Join(",", Enumerable.Range(0, 8)
                .Select(_ => PickPattern(rng, LevelSpeed(level), level).Id));
            Assert.AreEqual(expectedIds, ids);
        }
    }

    public class JumpPhysicsTests
    {
        private static Runner OnGround() => new() { Y = GROUND_Y, Vy = 0, Grounded = true };

        [Test]
        public void JumpsOnlyWhenGrounded()
        {
            var r = OnGround();
            Jump(r);
            Assert.AreEqual(JUMP_VELOCITY, r.Vy);
            Assert.IsFalse(r.Grounded);
            double vyMidair = r.Vy;
            Jump(r);
            Assert.AreEqual(vyMidair, r.Vy);
        }

        [Test]
        public void CompletesJumpArcAndLands()
        {
            var r = OnGround();
            Jump(r);
            double peak = GROUND_Y;
            for (int i = 0; i < 200 && !r.Grounded; i++)
            {
                StepRunner(r, 1.0 / 120, GROUND_Y);
                peak = System.Math.Min(peak, r.Y);
            }
            Assert.IsTrue(r.Grounded);
            Assert.AreEqual(GROUND_Y, r.Y);
            Assert.Greater(GROUND_Y - peak, 180); // analytic apex ≈ 200px
            Assert.Less(GROUND_Y - peak, 215);
        }

        [Test]
        public void AirJumpOnlyWhileBoostedAndOnce()
        {
            var r = OnGround();
            Assert.AreEqual("ground", TryJump(r, true));
            StepRunner(r, 0.05, GROUND_Y);
            Assert.AreEqual("air", TryJump(r, true));
            Assert.IsNull(TryJump(r, true));
        }
    }

    public class ObstacleTests
    {
        private static Obstacle Spike(double x, double elev = 0) =>
            new() { X = x, W = 60, H = 60, Elev = elev, Kind = ObstacleKind.Spike };
        private static Obstacle Block(double x, double h = 60, double w = 120, double elev = 0) =>
            new() { X = x, W = w, H = h, Elev = elev, Kind = ObstacleKind.Block };
        private static Obstacle Saw(double x) =>
            new() { X = x, W = 90, H = 90, Kind = ObstacleKind.Saw };
        private static Obstacle Pit(double x) =>
            new() { X = x, W = 150, H = 24, Kind = ObstacleKind.Pit };
        private static Obstacle Laser(double x) =>
            new() { X = x, W = 24, H = 130, Kind = ObstacleKind.Laser };
        private static Obstacle Swing(double x, double phase) =>
            new() { X = x, W = 54, H = 54, Kind = ObstacleKind.Swing, Phase = phase };
        /// <summary>Phase that puts the bob at its highest (+1) / lowest (-1) point at x.</summary>
        private static double PhaseFor(double x, int sign) =>
            sign * System.Math.PI / 2 - x * SWING_FREQ;

        [Test]
        public void SpikeKillsWithInsetForgiveness()
        {
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { Spike(PLAYER_X + PLAYER_SIZE - 10) }));
            Assert.IsTrue(CheckDeath(GROUND_Y, new[] { Spike(PLAYER_X + 20) }));
            Assert.IsFalse(CheckDeath(GROUND_Y - 100, new[] { Spike(PLAYER_X) }));
        }

        [Test]
        public void BlockKillsFromSideNotOnTop()
        {
            var b = Block(PLAYER_X + 20);
            Assert.IsTrue(CheckDeath(GROUND_Y, new[] { b }));
            Assert.IsFalse(CheckDeath(GROUND_Y - 60, new[] { b }));
            Assert.AreEqual(GROUND_Y - 60, SupportAt(GROUND_Y - 120, new[] { Block(PLAYER_X) }));
        }

        [Test]
        public void FloatingObstaclesAllowRunUnder()
        {
            var slab = Block(PLAYER_X, 60, 240, 90);
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { slab }));
            Assert.IsTrue(CheckDeath(GROUND_Y - 100, new[] { slab }));
            var mine = Spike(PLAYER_X, 110);
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { mine }));
            Assert.IsTrue(CheckDeath(GROUND_Y - 140, new[] { mine }));
        }

        [Test]
        public void SawIsRoundAndGrounded()
        {
            Assert.IsTrue(CheckDeath(GROUND_Y, new[] { Saw(PLAYER_X) }));
            // 4px of box overlap at the leading edge misses the disc.
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { Saw(PLAYER_X + PLAYER_SIZE - 4) }));
            Assert.IsFalse(CheckDeath(GROUND_Y - 160, new[] { Saw(PLAYER_X) }));
            Assert.AreEqual(GROUND_Y, SupportAt(GROUND_Y - 200, new[] { Saw(PLAYER_X) }));
        }

        [Test]
        public void PitKillsOnlyAtGroundLevel()
        {
            Assert.IsTrue(CheckDeath(GROUND_Y, new[] { Pit(PLAYER_X) }));
            Assert.IsFalse(CheckDeath(GROUND_Y - 40, new[] { Pit(PLAYER_X) }));
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { Pit(PLAYER_X + PLAYER_SIZE - 22) }));
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { Pit(PLAYER_X - 150 + 22) }));
        }

        [Test]
        public void SwingBobsInsideClearableBandDeterministically()
        {
            for (double x = 0; x < 1000; x += 37)
            {
                double elev = SwingElev(Swing(x, 1.3));
                Assert.GreaterOrEqual(elev, SWING_MID - SWING_AMP);
                Assert.LessOrEqual(elev, SWING_MID + SWING_AMP);
            }
            Assert.AreEqual(SwingElev(Swing(423, 2)), SwingElev(Swing(423, 2)));

            var high = Swing(PLAYER_X, PhaseFor(PLAYER_X, 1)); // elev 130
            Assert.IsFalse(CheckDeath(GROUND_Y, new[] { high }));
            Assert.IsTrue(CheckDeath(GROUND_Y - 140, new[] { high }));

            var low = Swing(PLAYER_X, PhaseFor(PLAYER_X, -1)); // elev 10
            Assert.IsTrue(CheckDeath(GROUND_Y, new[] { low }));
            Assert.IsFalse(CheckDeath(GROUND_Y - 150, new[] { low }));
        }

        [Test]
        public void LaserKillsOnContactClearedByJump()
        {
            Assert.IsTrue(CheckDeath(GROUND_Y, new[] { Laser(PLAYER_X) }));
            Assert.IsFalse(CheckDeath(GROUND_Y - 140, new[] { Laser(PLAYER_X) }));
        }
    }

    public class LevelSystemTests
    {
        [Test]
        public void WorldUnlocksOneKindPerWorld()
        {
            Assert.AreEqual(2, ObstacleKindsForLevel(5).Length);
            Assert.AreEqual(3, ObstacleKindsForLevel(6).Length);
            CollectionAssert.Contains(ObstacleKindsForLevel(6), ObstacleKind.Saw);
            Assert.AreEqual(4, ObstacleKindsForLevel(11).Length);
            Assert.AreEqual(5, ObstacleKindsForLevel(16).Length);
            Assert.AreEqual(6, ObstacleKindsForLevel(21).Length);
        }

        [Test]
        public void NoPatternUsesAKindBeforeItsWorld()
        {
            foreach (var p in PATTERNS)
                foreach (var o in p.Obstacles)
                    Assert.GreaterOrEqual(p.MinLevel, KindUnlockLevel(o.Kind), p.Id);
        }

        [Test]
        public void PickPatternRespectsLevelGating()
        {
            var locked = new[] { ObstacleKind.Saw, ObstacleKind.Pit, ObstacleKind.Swing, ObstacleKind.Laser };
            for (int i = 0; i < 500; i++)
            {
                var p = PickPattern(new Mulberry32((uint)i), LevelSpeed(5), 5);
                foreach (var o in p.Obstacles)
                    CollectionAssert.DoesNotContain(locked, o.Kind, p.Id);
            }
        }

        [Test]
        public void SpeedDurationAndGapsMatchWeb()
        {
            Assert.AreEqual(30, LevelDurationSec(1));
            Assert.AreEqual(45, LevelDurationSec(6));
            Assert.AreEqual(BASE_SPEED, LevelSpeed(1));
            Assert.AreEqual(540, LevelSpeed(4));
            Assert.AreEqual(MAX_SPEED, LevelSpeed(50));
            Assert.AreEqual(1260, LevelLengthM(1));
            Assert.AreEqual(2700, LevelLengthM(6));
            Assert.AreEqual(0.75, LevelGapScale(30));
        }

        [Test]
        public void EveryLevelStaysClearable()
        {
            for (int level = 1; level <= 25; level++)
            {
                double speed = LevelSpeed(level);
                double gap = MinGapPx(speed) * LevelGapScale(level);
                Assert.Greater(gap, JumpDistancePx(speed) + 0.2 * speed, $"level {level}");
            }
            foreach (var p in PATTERNS)
                foreach (var o in p.Obstacles)
                    if (o.Kind == ObstacleKind.Pit)
                        Assert.Greater(JumpDistancePx(LevelSpeed(p.MinLevel)),
                            o.W + PLAYER_SIZE + 20, p.Id);
        }
    }
}
