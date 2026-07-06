using UnityEngine;

namespace CubeDash.View
{
    /// <summary>
    /// ParticleSystem builders matching the web build's four emitters: square
    /// "dot" particles (Phaser's 8px dot texture), same speeds/lifetimes/tints.
    /// </summary>
    public static class Fx
    {
        private static Material _mat;

        private static Material Mat()
        {
            if (_mat == null)
            {
                // Additive square dots: particles glow instead of just tinting.
                _mat = new Material(Shader.Find("Legacy Shaders/Particles/Additive"));
                _mat.mainTexture = Draw.White().texture;
            }
            return _mat;
        }

        private static ParticleSystem Base(Transform parent, string name, int order)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.playOnAwake = false;
            main.maxParticles = 300;
            var shape = ps.shape;
            shape.enabled = false;
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.material = Mat();
            r.sortingOrder = order;
            var sol = ps.sizeOverLifetime;
            sol.enabled = true;
            sol.size = new ParticleSystem.MinMaxCurve(1f,
                AnimationCurve.Linear(0f, 1f, 1f, 0f));
            var col = ps.colorOverLifetime;
            col.enabled = true;
            var grad = new Gradient();
            grad.SetKeys(
                new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
            col.color = grad;
            return ps;
        }

        private static void Tint(ParticleSystem ps, uint a, uint b, float alpha)
        {
            var main = ps.main;
            main.startColor = new ParticleSystem.MinMaxGradient(Px.C(a, alpha), Px.C(b, alpha));
        }

        /// <summary>Skin-tinted trail streaming behind the player while running.</summary>
        public static ParticleSystem Trail(Transform followParent, uint[] trailColors)
        {
            var ps = Base(followParent, "trail", 90);
            var main = ps.main;
            main.startLifetime = 0.35f;
            main.startSize = 9f;
            main.startSpeed = 0f;
            Tint(ps, trailColors[0], trailColors[1], 0.45f);
            var vel = ps.velocityOverLifetime;
            vel.enabled = true;
            vel.space = ParticleSystemSimulationSpace.World;
            vel.x = new ParticleSystem.MinMaxCurve(-40f, -10f);
            vel.y = new ParticleSystem.MinMaxCurve(-20f, 20f);
            var em = ps.emission;
            em.rateOverTime = 35f;
            return ps;
        }

        public static ParticleSystem Dust(Transform parent)
        {
            var ps = Base(parent, "dust", 90);
            var main = ps.main;
            main.startLifetime = 0.3f;
            main.startSize = 7f;
            main.startSpeed = new ParticleSystem.MinMaxCurve(40f, 140f);
            Tint(ps, 0x9e9e9e, 0x9e9e9e, 0.6f);
            var shape = ps.shape;
            shape.enabled = true;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = 70f;
            shape.rotation = new Vector3(-90f, 0f, 0f); // fan upward
            var em = ps.emission;
            em.rateOverTime = 0f;
            return ps;
        }

        public static ParticleSystem Sparkle(Transform parent)
        {
            var ps = Base(parent, "sparkle", 120);
            var main = ps.main;
            main.startLifetime = 0.45f;
            main.startSize = 10f;
            main.startSpeed = new ParticleSystem.MinMaxCurve(80f, 260f);
            Tint(ps, 0xffd54f, 0xfff59d, 1f);
            var em = ps.emission;
            em.rateOverTime = 0f;
            return ps;
        }

        /// <summary>Death burst: chunky, gravity-pulled shards.</summary>
        public static ParticleSystem Burst(Transform parent)
        {
            var ps = Base(parent, "burst", 120);
            var main = ps.main;
            main.startLifetime = 0.6f;
            main.startSize = 13f;
            main.startSpeed = new ParticleSystem.MinMaxCurve(120f, 420f);
            main.gravityModifier = 900f / 9.81f; // Phaser gravityY 900 px/s²
            Tint(ps, 0x26c6da, 0xef5350, 1f);
            var em = ps.emission;
            em.rateOverTime = 0f;
            return ps;
        }

        public static void Explode(ParticleSystem ps, int count, Vector3 worldPos)
        {
            ps.transform.position = worldPos;
            ps.Emit(count);
        }
    }
}
