using CubeDash.View;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CubeDash.Game
{
    /// <summary>
    /// uGUI helpers styled like @mg/ui (textButton with padded dark background,
    /// drop-shadowed text). Positions are given in the web build's canvas
    /// space: 720x1280, origin TOP-LEFT, y down.
    /// </summary>
    public static class UiFactory
    {
        private static Font _font;

        public static Font DefaultFont()
        {
            if (_font == null)
                _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            return _font;
        }

        public static Canvas EnsureCanvas(string name = "canvas")
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(720, 1280);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();

            if (Object.FindFirstObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem");
                es.AddComponent<EventSystem>();
                es.AddComponent<StandaloneInputModule>();
            }
            return canvas;
        }

        private static RectTransform Rect(Transform parent, string name, double x, double y,
            double w, double h)
        {
            var go = new GameObject(name);
            var rt = go.AddComponent<RectTransform>();
            rt.SetParent(parent, false);
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2((float)w, (float)h);
            rt.anchoredPosition = new Vector2((float)x - 360f, 640f - (float)y);
            return rt;
        }

        public static Text Label(Transform parent, string text, double x, double y,
            int fontSize, uint color, bool bold = false, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var rt = Rect(parent, $"label:{text}", x, y, 700, fontSize * 2.6);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = DefaultFont();
            t.fontSize = fontSize;
            t.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
            t.alignment = align;
            t.color = Px.C(color);
            t.text = text;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            var shadow = rt.gameObject.AddComponent<Shadow>();
            shadow.effectDistance = new Vector2(0, -Mathf.Max(2, fontSize * 0.09f));
            shadow.effectColor = new Color(0, 0, 0, 0.8f);
            return t;
        }

        /// <summary>Padded text button, @mg/ui textButton style.</summary>
        public static Button TextButton(Transform parent, string label, double x, double y,
            int fontSize, uint textColor, uint bgColor, UnityAction onClick,
            double w = 0, double h = 0)
        {
            if (w <= 0) w = label.Length * fontSize * 0.62 + fontSize * 1.4;
            if (h <= 0) h = fontSize * 1.9;
            var rt = Rect(parent, $"btn:{label}", x, y, w, h);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = Px.C(bgColor);
            var btn = rt.gameObject.AddComponent<Button>();
            btn.onClick.AddListener(onClick);
            var colors = btn.colors;
            colors.highlightedColor = new Color(1.15f, 1.15f, 1.15f, 1f);
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1f);
            btn.colors = colors;

            var text = Label(rt, label, 360, 640, fontSize, textColor);
            var trt = text.GetComponent<RectTransform>();
            trt.anchoredPosition = Vector2.zero;
            trt.sizeDelta = new Vector2((float)w, (float)h);
            return btn;
        }

        public static Image Panel(Transform parent, double x, double y, double w, double h,
            uint color, float alpha)
        {
            var rt = Rect(parent, "panel", x, y, w, h);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = Px.C(color, alpha);
            return img;
        }

        /// <summary>floatBanner port: celebration text that rises and fades.</summary>
        public static void FloatBanner(Transform parent, string text, double y, int fontSize, uint color)
        {
            var label = Label(parent, text, 360, y, fontSize, color, bold: true);
            label.gameObject.AddComponent<BannerFloat>();
        }

        private sealed class BannerFloat : MonoBehaviour
        {
            private float _t;
            private Text _text;
            private RectTransform _rt;

            private void Start()
            {
                _text = GetComponent<Text>();
                _rt = GetComponent<RectTransform>();
            }

            private void Update()
            {
                _t += Time.deltaTime;
                _rt.anchoredPosition += new Vector2(0, 60f * Time.deltaTime);
                var c = _text.color;
                c.a = Mathf.Clamp01(1.2f - _t);
                _text.color = c;
                if (_t > 1.4f) Destroy(gameObject);
            }
        }
    }
}
