using System.Linq;
using CubeDash.Logic;
using NUnit.Framework;

namespace CubeDash.Tests
{
    public class RngTests
    {
        // Reference values from the TS mulberry32 (packages/core/src/rng.ts):
        // the RNG stays bit-compatible with the rest of the portfolio.
        [Test]
        public void MatchesReferenceMulberry32()
        {
            var rng = new Mulberry32(7919);
            double[] expected =
            {
                0.69009949848987162, 0.74164396990090609, 0.37708328501321375,
                0.80804109387099743, 0.24781381688080728,
            };
            foreach (double e in expected)
                Assert.That(rng.Next(), Is.EqualTo(e).Within(1e-16));
        }
    }

    public class SimPhysicsTests
    {
        private static readonly Ob[] NoObs = { };
        private static readonly Gap[] NoGaps = { };

        private static PlayerState Grounded() => new() { X = 0, Y = 0, Grounded = true };

        [Test]
        public void JumpArcReachesApexAndLands()
        {
            var p = Grounded();
            Assert.IsTrue(Sim.RequestJump(p));
            p.JustJumped = false;
            float peak = 0;
            for (int i = 0; i < 1000 && !(p.Grounded && i > 1); i++)
            {
                Sim.Step(p, 1f / 240, 400, NoObs, NoGaps);
                peak = System.Math.Max(peak, p.Y);
                if (p.Grounded) break;
            }
            Assert.IsTrue(p.Grounded);
            Assert.AreEqual(0, p.Y, 0.001);
            Assert.Greater(peak, Sim.JumpApex - 12);
            Assert.Less(peak, Sim.JumpApex + 12);
        }

        [Test]
        public void HoldingJumpFloatsTheApex()
        {
            float Airtime(bool held)
            {
                var p = Grounded();
                p.JumpHeld = held;
                Sim.RequestJump(p);
                float t = 0;
                for (int i = 0; i < 2000 && !p.Grounded; i++)
                {
                    Sim.Step(p, 1f / 240, 400, NoObs, NoGaps);
                    t += 1f / 240;
                }
                return t;
            }
            Assert.Greater(Airtime(true), Airtime(false) + 0.02f);
        }

        [Test]
        public void CoyoteGraceAllowsLateJumpsOffEdges()
        {
            var p = Grounded();
            var gaps = new[] { new Gap(10, 800) };
            for (int i = 0; i < 500 && p.Grounded; i++)
                Sim.Step(p, 1f / 240, 400, NoObs, gaps);
            Assert.IsFalse(p.Grounded);
            Sim.Step(p, 1f / 240, 400, NoObs, gaps); // one more falling frame
            Assert.IsTrue(Sim.RequestJump(p), "coyote window should fire the jump");
        }

        [Test]
        public void BufferedJumpFiresOnLanding()
        {
            var p = new PlayerState { X = 0, Y = 60, Vy = -200, Grounded = false };
            Assert.IsFalse(Sim.RequestJump(p)); // airborne, no coyote: buffered
            for (int i = 0; i < 500 && p.Vy <= 0; i++)
                Sim.Step(p, 1f / 240, 400, NoObs, NoGaps);
            Assert.IsTrue(p.JustJumped);
            Assert.AreEqual(Sim.JumpVelocity, p.Vy, 0.001);
        }

        [Test]
        public void SupportComesFromGroundBlocksAndGaps()
        {
            var p = Grounded();
            Assert.AreEqual(0, Sim.SupportAt(p, NoObs, NoGaps));
            var block = new Ob { X = 20, W = 110, H = 65, Y = 0, Kind = ObKind.Block };
            p.Y = 65;
            Assert.AreEqual(65, Sim.SupportAt(p, new[] { block }, NoGaps));
            // Toes over the lip don't fall; fully over the hole does.
            var gaps = new[] { new Gap(100, 260) };
            p.Y = 0;
            p.X = 50;
            Assert.AreEqual(0, Sim.SupportAt(p, NoObs, gaps));
            p.X = 110;
            Assert.IsTrue(float.IsNegativeInfinity(Sim.SupportAt(p, NoObs, gaps)));
        }

        [Test]
        public void DeathRules()
        {
            var p = Grounded();
            // Falling into a gap.
            Assert.IsFalse(Sim.CheckDeath(p, NoObs));
            p.Y = Sim.KillDepth - 10;
            Assert.IsTrue(Sim.CheckDeath(p, NoObs));
            p.Y = 0;

            var spike = new Ob { X = 0, W = 60, H = 60, Y = 0, Kind = ObKind.Spike };
            Assert.IsTrue(Sim.CheckDeath(p, new[] { spike }));
            Assert.IsFalse(Sim.CheckDeath(new PlayerState { X = 0, Y = 140 }, new[] { spike }));
            // Bounding boxes touch but the trimmed hitbox forgives the graze.
            Assert.IsFalse(Sim.CheckDeath(p, new[] { new Ob { X = 44, W = 60, H = 60, Kind = ObKind.Spike } }));

            var block = new Ob { X = 20, W = 110, H = 65, Y = 0, Kind = ObKind.Block };
            Assert.IsTrue(Sim.CheckDeath(p, new[] { block }));  // side hit
            Assert.IsFalse(Sim.CheckDeath(new PlayerState { X = 20, Y = 65 }, new[] { block })); // on top

            var saw = new Ob { X = 0, W = 92, H = 92, Y = 0, Kind = ObKind.Saw };
            Assert.IsTrue(Sim.CheckDeath(p, new[] { saw }));
            Assert.IsFalse(Sim.CheckDeath(new PlayerState { X = 0, Y = 160 }, new[] { saw }));

            var mine = new Ob { X = 0, W = 54, H = 54, Y = 120, Kind = ObKind.Mine };
            Assert.IsFalse(Sim.CheckDeath(p, new[] { mine }));  // safe underneath
            Assert.IsTrue(Sim.CheckDeath(new PlayerState { X = 0, Y = 110 }, new[] { mine }));

            var beam = new Ob { X = 0, W = 26, H = 135, Y = 0, Kind = ObKind.Beam };
            Assert.IsTrue(Sim.CheckDeath(p, new[] { beam }));
            Assert.IsFalse(Sim.CheckDeath(new PlayerState { X = 0, Y = 140 }, new[] { beam }));
        }
    }

    public class ChunkTests
    {
        [Test]
        public void LevelsAreDeterministicAndDistinct()
        {
            CollectionAssert.AreEqual(Chunks.Build(3).ChunkIds, Chunks.Build(3).ChunkIds);
            CollectionAssert.AreNotEqual(Chunks.Build(3).ChunkIds, Chunks.Build(4).ChunkIds);
        }

        [Test]
        public void BuildsRespectTierGating()
        {
            var byId = Chunks.LIBRARY.ToDictionary(c => c.Id);
            for (int level = 1; level <= 12; level++)
                foreach (string id in Chunks.Build(level).ChunkIds)
                    Assert.LessOrEqual(byId[id].Tier, Chunks.MaxTier(level), $"level {level}: {id}");
        }

        [Test]
        public void EveryGapIsJumpableAtItsUnlockSpeed()
        {
            foreach (var c in Chunks.LIBRARY)
            {
                if (!c.HasGap) continue;
                float speed = Chunks.LevelSpeed(Chunks.TierUnlockLevel(c.Tier));
                // Takeoff/landing can each hang 30% of the cube over the lip.
                float effective = c.GapWidth + Sim.PlayerSize * 0.4f;
                Assert.Greater(Sim.JumpDistance(speed), effective + 20, c.Id);
            }
        }

        [Test]
        public void EveryStandableTopIsReachableAndRunUndersAreClear()
        {
            foreach (var c in Chunks.LIBRARY)
                foreach (var o in c.Obs)
                {
                    if (o.Kind is ObKind.Block or ObKind.Slab)
                        Assert.LessOrEqual(o.Y + o.H, Sim.JumpApex - 26, $"{c.Id}: top too high");
                    if (o.Y > 0)
                        Assert.GreaterOrEqual(o.Y, Sim.PlayerSize + 20, $"{c.Id}: run-under too low");
                }
        }

        [Test]
        public void PadNeverDropsBelowReactionFloor()
        {
            for (int level = 1; level <= 30; level++)
                Assert.Greater(Chunks.PadPx(level), Chunks.LevelSpeed(level) * 0.3f, $"level {level}");
        }

        [Test]
        public void LevelParamsRamp()
        {
            Assert.AreEqual(30, Chunks.LevelDurationSec(1));
            Assert.AreEqual(30, Chunks.LevelDurationSec(5));
            Assert.AreEqual(38, Chunks.LevelDurationSec(6));
            Assert.AreEqual(Chunks.BaseSpeed, Chunks.LevelSpeed(1));
            Assert.AreEqual(Chunks.MaxSpeed, Chunks.LevelSpeed(50));
            Assert.AreEqual(0, Chunks.MaxTier(1));
            Assert.AreEqual(1, Chunks.MaxTier(3));
            Assert.AreEqual(3, Chunks.MaxTier(7));
            Assert.AreEqual(3, Chunks.MaxTier(99));
        }

        [Test]
        public void LayoutsLeaveOpeningAndFinishRunways()
        {
            for (int level = 1; level <= 10; level++)
            {
                var layout = Chunks.Build(level);
                foreach (var o in layout.Obs)
                {
                    Assert.GreaterOrEqual(o.X, Chunks.OpeningRunwayPx, $"level {level}");
                    Assert.LessOrEqual(o.Right, layout.LengthPx - Chunks.FinishRunwayPx + 100,
                        $"level {level}");
                }
            }
        }
    }
}
