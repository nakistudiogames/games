using System;
using System.Collections.Generic;

namespace CubeDash.Logic
{
    /// <summary>
    /// Bit-exact port of the web version's seedable RNG (packages/core/src/rng.ts,
    /// mulberry32). Same seed => same float sequence => identical level layouts
    /// in both engines, which is the point of the comparison.
    /// </summary>
    public sealed class Mulberry32
    {
        private uint _state;

        public Mulberry32(uint seed) => _state = seed;

        /// <summary>Uniform double in [0, 1). Matches JS `next()` exactly.</summary>
        public double Next()
        {
            unchecked
            {
                _state += 0x6d2b79f5u;
                uint t = _state;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        /// <summary>Uniform integer in [0, maxExclusive).</summary>
        public int Int(int maxExclusive) => (int)Math.Floor(Next() * maxExclusive);

        public T Pick<T>(IReadOnlyList<T> items)
        {
            if (items.Count == 0) throw new InvalidOperationException("Pick: empty list");
            return items[Int(items.Count)];
        }
    }
}
