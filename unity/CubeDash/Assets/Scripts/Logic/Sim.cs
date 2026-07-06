using System;
using System.Collections.Generic;

namespace CubeDash.Logic
{
    // Native simulation for the rebuilt game — NOT a port. Y grows UP, the
    // ground's top surface is y = 0, and the PLAYER moves forward through a
    // fixed, pre-built level (the camera follows). Units are pixels of a
    // 720x1280 reference view.

    public enum ObKind
    {
        Spike,  // ground triangle: jump it
        Block,  // solid box: land on top, die on the side
        Saw,    // spinning disc, circular hitbox
        Mine,   // floating spike ball: fatal in its band, safe under
        Beam,   // thin tall energy pylon: late precise jump
        Slab,   // floating platform: land on it or run under
    }

    /// <summary>Static level geometry. X = left edge, Y = bottom edge (y-up).</summary>
    public sealed class Ob
    {
        public float X, W, H, Y;
        public ObKind Kind;
        public float Right => X + W;
        public float Top => Y + H;
    }

    /// <summary>A hole in the ground: run in = fall = death. Jump across.</summary>
    public readonly struct Gap
    {
        public readonly float Start, End;
        public Gap(float start, float end) { Start = start; End = end; }
        public float Width => End - Start;
    }

    public sealed class PlayerState
    {
        public float X;
        /// <summary>Bottom edge of the player square.</summary>
        public float Y;
        public float Vy;
        public bool Grounded = true;
        public bool JumpHeld;
        public float CoyoteLeft;
        public float BufferLeft;
        /// <summary>True the frame a landing happened (view feedback hook).</summary>
        public bool JustLanded;
        /// <summary>True the frame a jump started (view feedback hook).</summary>
        public bool JustJumped;
    }

    public static class Sim
    {
        public const float PlayerSize = 60;

        public const float Gravity = 5200;      // px/s², downward
        public const float JumpVelocity = 1500; // px/s, upward
        /// <summary>Holding jump softens gravity near the apex — floatier,
        /// more controllable arcs without changing max height much.</summary>
        public const float ApexFloatBand = 260;
        public const float ApexFloatScale = 0.78f;

        public const float CoyoteSec = 0.08f;  // jump grace after leaving an edge
        public const float BufferSec = 0.12f;  // early tap still fires on landing

        public const float KillDepth = -110;   // fell into a gap

        /// <summary>Full-jump airtime from flat ground (no apex float).</summary>
        public const float JumpAirtime = 2 * JumpVelocity / Gravity; // ≈ 0.577s
        /// <summary>Jump apex height ≈ 216 px.</summary>
        public const float JumpApex = JumpVelocity * JumpVelocity / (2 * Gravity);

        public static float JumpDistance(float speed) => speed * JumpAirtime;

        /// <summary>Queue a jump: fires now if grounded/coyote, else buffers.</summary>
        public static bool RequestJump(PlayerState p)
        {
            if (p.Grounded || p.CoyoteLeft > 0)
            {
                p.Vy = JumpVelocity;
                p.Grounded = false;
                p.CoyoteLeft = 0;
                p.JustJumped = true;
                return true;
            }
            p.BufferLeft = BufferSec;
            return false;
        }

        /// <summary>The surface under the player at x: ground top (0), a block/
        /// slab top, or -infinity over a gap.</summary>
        public static float SupportAt(PlayerState p, IReadOnlyList<Ob> obs, IReadOnlyList<Gap> gaps)
        {
            float left = p.X, right = p.X + PlayerSize;
            float support = 0;
            // A gap only swallows the player once MOST of the cube is over it —
            // toes hanging off an edge still count as standing.
            foreach (var g in gaps)
                if (left + PlayerSize * 0.3f >= g.Start && right - PlayerSize * 0.3f <= g.End)
                    support = float.NegativeInfinity;
            foreach (var o in obs)
            {
                if (o.Kind != ObKind.Block && o.Kind != ObKind.Slab) continue;
                if (right <= o.X || left >= o.Right) continue;
                // Land only when coming from above (small tolerance).
                if (p.Y >= o.Top - 10 && o.Top > support) support = o.Top;
            }
            return support;
        }

        // NOTE: Step does NOT clear JustLanded/JustJumped — they are one-shot
        // events the view layer consumes (and resets) after each frame.
        public static void Step(PlayerState p, float dt, float speed,
            IReadOnlyList<Ob> obs, IReadOnlyList<Gap> gaps)
        {
            p.X += speed * dt;

            float support = SupportAt(p, obs, gaps);
            if (p.Grounded && p.Y > support + 0.5f)
            {
                // Walked off an edge: start falling, grant coyote grace.
                p.Grounded = false;
                p.CoyoteLeft = CoyoteSec;
            }

            if (!p.Grounded)
            {
                float g = Gravity;
                if (p.JumpHeld && Math.Abs(p.Vy) < ApexFloatBand && p.Vy != 0)
                    g *= ApexFloatScale;
                p.Vy -= g * dt;
                float newY = p.Y + p.Vy * dt;
                if (p.Vy < 0 && newY <= support)
                {
                    p.Y = support;
                    p.Vy = 0;
                    p.Grounded = true;
                    p.JustLanded = true;
                    if (p.BufferLeft > 0)
                    {
                        p.BufferLeft = 0;
                        RequestJump(p);
                        p.JustLanded = true; // landed AND re-jumped this frame
                    }
                }
                else
                {
                    p.Y = newY;
                }
                p.CoyoteLeft = Math.Max(0, p.CoyoteLeft - dt);
            }
            p.BufferLeft = Math.Max(0, p.BufferLeft - dt);
        }

        /// <summary>Fatal overlap test. Hitboxes are forgiving: insets on
        /// spikes/beams, circles for saws/mines, side-only kills on solids.</summary>
        public static bool CheckDeath(PlayerState p, IReadOnlyList<Ob> obs)
        {
            if (p.Y < KillDepth) return true;
            float pl = p.X + 8, pr = p.X + PlayerSize - 8;
            float pb = p.Y + 4, pt = p.Y + PlayerSize - 4;
            foreach (var o in obs)
            {
                switch (o.Kind)
                {
                    case ObKind.Spike:
                    {
                        // Trimmed box: the pointy top half is forgiving.
                        float inset = o.W * 0.25f;
                        if (pr > o.X + inset && pl < o.Right - inset &&
                            pb < o.Y + o.H * 0.62f && pt > o.Y + 6)
                            return true;
                        break;
                    }
                    case ObKind.Saw:
                    case ObKind.Mine:
                    {
                        float r = o.W / 2 - (o.Kind == ObKind.Saw ? 8 : 6);
                        float cx = o.X + o.W / 2, cy = o.Y + o.H / 2;
                        float nx = Math.Clamp(cx, pl, pr);
                        float ny = Math.Clamp(cy, pb, pt);
                        if ((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < r * r) return true;
                        break;
                    }
                    case ObKind.Beam:
                    {
                        if (pr > o.X + 5 && pl < o.Right - 5 && pb < o.Top - 4 && pt > o.Y + 4)
                            return true;
                        break;
                    }
                    default: // Block, Slab: fatal only from the side/below
                    {
                        if (pr > o.X + 2 && pl < o.Right - 2 && pb < o.Top - 9 && pt > o.Y + 4)
                            return true;
                        break;
                    }
                }
            }
            return false;
        }
    }
}
