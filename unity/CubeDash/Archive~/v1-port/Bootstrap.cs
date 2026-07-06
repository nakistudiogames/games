using CubeDash.View;
using UnityEngine;

namespace CubeDash.Game
{
    /// <summary>
    /// No authored scenes: this runs on play in ANY scene and builds the whole
    /// game from code, mirroring how the Phaser build constructs itself in
    /// create(). Camera is orthographic with 1 unit = 1 px of the web build's
    /// 720x1280 canvas.
    /// </summary>
    public static class Bootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Init()
        {
            if (Object.FindFirstObjectByType<MenuController>() != null) return;

            // Crispness: MSAA smooths rotated quad edges (diamonds, gems,
            // pickups); textures are supersampled separately (Painter.SS).
            QualitySettings.antiAliasing = 8;
            Application.targetFrameRate = 120;

            var cam = Camera.main;
            if (cam == null)
            {
                var go = new GameObject("Main Camera") { tag = "MainCamera" };
                cam = go.AddComponent<Camera>();
            }
            cam.orthographic = true;
            cam.orthographicSize = Px.HEIGHT / 2f;
            cam.transform.position = new Vector3(0, 0, -10);
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.black;
            if (cam.GetComponent<AudioListener>() == null) cam.gameObject.AddComponent<AudioListener>();
            if (cam.GetComponent<AspectFitter>() == null) cam.gameObject.AddComponent<AspectFitter>();

            // Clears the letterbox area outside the fitted main camera rect.
            var clear = new GameObject("clear-cam").AddComponent<Camera>();
            clear.depth = cam.depth - 1;
            clear.cullingMask = 0;
            clear.clearFlags = CameraClearFlags.SolidColor;
            clear.backgroundColor = Color.black;

            Flow.ToMenu();
        }
    }

    /// <summary>Keeps the view 9:16 whatever the window shape (pillar/letterbox).</summary>
    public sealed class AspectFitter : MonoBehaviour
    {
        private Camera _cam;

        private void Awake() => _cam = GetComponent<Camera>();

        private void Update()
        {
            const float target = Px.WIDTH / Px.HEIGHT;
            float window = (float)Screen.width / Screen.height;
            if (window > target)
            {
                float w = target / window;
                _cam.rect = new Rect((1 - w) / 2, 0, w, 1);
            }
            else
            {
                float h = window / target;
                _cam.rect = new Rect(0, (1 - h) / 2, 1, h);
            }
        }
    }

    /// <summary>Scene-free screen switching: each screen lives under one root
    /// GameObject; swapping destroys the old tree (world objects + canvas).</summary>
    public static class Flow
    {
        private static GameObject _current;

        public static void ToMenu()
        {
            Swap("menu").AddComponent<MenuController>();
        }

        public static void ToGame(int level)
        {
            var gc = Swap("game").AddComponent<GameController>();
            gc.Level = level;
        }

        private static GameObject Swap(string name)
        {
            if (_current != null) Object.Destroy(_current);
            _current = new GameObject($"screen-{name}");
            return _current;
        }
    }
}
