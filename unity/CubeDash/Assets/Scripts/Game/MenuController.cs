using CubeDash.Logic;
using CubeDash.View;
using UnityEngine;
using UnityEngine.UI;
using static CubeDash.Logic.RunnerLogic;

namespace CubeDash.Game
{
    /// <summary>
    /// Port of MenuScene.ts: level selector with ◀ ▶ stepping, direct-select
    /// grid overlay (5x4 tiles, best-% / cleared / locked), and the character
    /// picker with a live world-space preview incl. the signature aura.
    /// </summary>
    public sealed class MenuController : MonoBehaviour
    {
        private Canvas _canvas;
        private int _selected = 1;
        private int _charIndex;
        private Text _levelWord, _levelLabel, _levelInfo, _lockHint, _charName;
        private GameObject _charPreview;
        private GameObject _gridOverlay;

        private void Start()
        {
            int unlocked = Storage.GetInt("unlockedLevel", 1);
            _selected = Mathf.Min(Storage.GetInt("lastPlayed", 1), unlocked);

            // Backdrop: world-1 sky so the menu shares the game's vibe.
            var world = WorldData.ForLevel(1);
            var sky = Draw.FromSprite(transform, "sky", TextureFactory.Sky(world), 0);
            sky.transform.position = Px.V(360, 640);
            sky.transform.localScale = new Vector3(Px.WIDTH / 2f, Px.HEIGHT / 2f, 1f);
            var sil = Draw.FromSprite(transform, "sil", TextureFactory.Silhouette(world), 1);
            sil.transform.position = Px.V(0, Px.HEIGHT - 320);
            var silSr = sil.GetComponent<SpriteRenderer>();
            silSr.drawMode = SpriteDrawMode.Tiled;
            silSr.size = new Vector2(Px.WIDTH, 320);
            silSr.color = new Color(1, 1, 1, 0.35f);

            _canvas = UiFactory.EnsureCanvas("menu-ui");
            _canvas.transform.SetParent(transform, false);
            var root = _canvas.transform;

            var title = UiFactory.Label(root, "CUBE\nDASH", 360, 1280 * 0.2, 110, 0xffffff, bold: true);
            var outline = title.gameObject.AddComponent<Outline>();
            outline.effectColor = Px.C(0x26c6da);
            outline.effectDistance = new Vector2(5, -5);

            _levelWord = UiFactory.Label(root, "LEVEL", 360, 1280 * 0.395, 34, 0x8a93a8);
            _levelLabel = UiFactory.Label(root, "", 360, 1280 * 0.455, 72, 0xffffff, bold: true);
            _levelInfo = UiFactory.Label(root, "", 360, 1280 * 0.52, 36, 0x8a93a8);
            _lockHint = UiFactory.Label(root, "", 360, 1280 * 0.585, 30, 0x5c667d);

            UiFactory.TextButton(root, "<", 140, 1280 * 0.455, 52, 0xffffff, 0x232b3e, () =>
            {
                _selected = Mathf.Max(1, _selected - 1);
                Refresh();
            }, 90, 90);
            UiFactory.TextButton(root, ">", 580, 1280 * 0.455, 52, 0xffffff, 0x232b3e, () =>
            {
                _selected = Mathf.Min(Storage.GetInt("unlockedLevel", 1), _selected + 1);
                Refresh();
            }, 90, 90);
            // Grid shortcut (the web build's ⊞ button).
            UiFactory.TextButton(root, "#", 670, 1280 * 0.455, 36, 0x8a93a8, 0x232b3e,
                OpenLevelGrid, 70, 70);

            UiFactory.TextButton(root, "PLAY", 360, 1280 * 0.68, 60, 0xa5d6a7, 0x1e3320, () =>
            {
                Storage.SetInt("lastPlayed", _selected);
                Flow.ToGame(_selected);
            }, 320, 110);

            UiFactory.Label(root, "CHARACTER", 360, 1280 * 0.78, 28, 0x5c667d);
            _charName = UiFactory.Label(root, "", 360, 1280 * 0.915, 32, 0xffffff);
            string savedId = Storage.GetString("character", "dash");
            for (int i = 0; i < CharacterData.CHARACTERS.Length; i++)
                if (CharacterData.CHARACTERS[i].Id == savedId) _charIndex = i;
            UiFactory.TextButton(root, "<", 200, 1280 * 0.85, 40, 0xffffff, 0x232b3e, () =>
            {
                _charIndex = (_charIndex + CharacterData.CHARACTERS.Length - 1) % CharacterData.CHARACTERS.Length;
                RefreshCharacter();
            }, 80, 80);
            UiFactory.TextButton(root, ">", 520, 1280 * 0.85, 40, 0xffffff, 0x232b3e, () =>
            {
                _charIndex = (_charIndex + 1) % CharacterData.CHARACTERS.Length;
                RefreshCharacter();
            }, 80, 80);

            Refresh();
            RefreshCharacter();
        }

        private void Refresh()
        {
            int unlocked = Storage.GetInt("unlockedLevel", 1);
            uint accent = LevelColor(_selected);
            _levelWord.color = Px.C(accent);
            _levelLabel.text = _selected.ToString();
            _levelLabel.color = Px.C(accent);

            int best = Storage.GetInt($"bestPct:{_selected}", 0);
            bool cleared = best >= 100;
            string bestPart = best > 0 ? cleared ? "  ·  cleared" : $"  ·  best {best}%" : "";
            _levelInfo.text =
                $"{WorldData.ForLevel(_selected).Name}  ·  {LevelDurationSec(_selected):0}s{bestPart}";
            _lockHint.text = _selected == unlocked && !cleared
                ? $"clear this level to unlock level {unlocked + 1}"
                : "";
        }

        private void RefreshCharacter()
        {
            var spec = CharacterData.CHARACTERS[_charIndex];
            bool unlocked = CharacterData.IsUnlocked(spec, Storage.GetInt("unlockedLevel", 1));

            if (_charPreview != null) Destroy(_charPreview);
            _charPreview = new GameObject("char-preview");
            _charPreview.transform.SetParent(transform, false);
            _charPreview.transform.position = Px.V(360, 1280 * 0.85);
            CharacterFactory.BuildParts(_charPreview.transform, spec, 60, 10);
            if (unlocked)
            {
                Auras.Attach(_charPreview.transform, spec, 60, 9);
                _charName.text = spec.Name;
                _charName.color = Px.C(spec.Color);
                // Browsing an unlocked character selects it immediately.
                Storage.SetString("character", spec.Id);
            }
            else
            {
                foreach (var sr in _charPreview.GetComponentsInChildren<SpriteRenderer>())
                {
                    var c = sr.color;
                    c.a *= 0.35f;
                    sr.color = c;
                }
                _charName.text = $"LOCKED — clear level {spec.MinLevel - 1}";
                _charName.color = Px.C(0x5c667d);
            }
        }

        /// <summary>Overlay grid to jump straight to any unlocked level.</summary>
        private void OpenLevelGrid()
        {
            if (_gridOverlay != null) return;
            int unlocked = Storage.GetInt("unlockedLevel", 1);
            int total = unlocked + 4; // peek a few locked levels ahead
            const int perPage = 20;   // 5 x 4 tiles
            int pages = Mathf.CeilToInt((float)total / perPage);
            int page = Mathf.Min((_selected - 1) / perPage, pages - 1);

            _gridOverlay = new GameObject("level-grid");
            var rt = _gridOverlay.AddComponent<RectTransform>();
            rt.SetParent(_canvas.transform, false);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            _gridOverlay.AddComponent<Image>().color = Px.C(0x0b0e18, 0.95f);

            UiFactory.Label(rt, "SELECT LEVEL", 360, 150, 52, 0xffffff, bold: true);
            var tilesRoot = new GameObject("tiles").AddComponent<RectTransform>();
            tilesRoot.SetParent(rt, false);
            tilesRoot.anchorMin = Vector2.zero;
            tilesRoot.anchorMax = Vector2.one;
            tilesRoot.offsetMin = tilesRoot.offsetMax = Vector2.zero;
            var pageText = UiFactory.Label(rt, "", 360, 1280 - 165, 30, 0x8a93a8);

            void RenderPage()
            {
                foreach (Transform child in tilesRoot) Destroy(child.gameObject);
                int start = page * perPage;
                for (int i = 0; i < perPage; i++)
                {
                    int lvl = start + i + 1;
                    if (lvl > total) break;
                    double x = 360 - 248 + i % 5 * 124;
                    double y = 330 + i / 5 * 130;
                    bool isUnlocked = lvl <= unlocked;
                    int best = Storage.GetInt($"bestPct:{lvl}", 0);

                    // Tile: accent border quad behind a dark face.
                    UiFactory.Panel(tilesRoot, x, y, 110, 110,
                        isUnlocked ? LevelColor(lvl) : 0x2a3040, 1f);
                    var face = UiFactory.TextButton(tilesRoot,
                        isUnlocked ? lvl.ToString() : "-", x, y, 40,
                        isUnlocked ? 0xffffffu : 0x5c667du,
                        isUnlocked ? 0x1b2233u : 0x141824u,
                        () =>
                        {
                            if (!isUnlocked) return;
                            _selected = lvl;
                            Refresh();
                            Destroy(_gridOverlay);
                            _gridOverlay = null;
                        }, 104, 104);
                    face.interactable = isUnlocked;
                    if (isUnlocked && best > 0)
                        UiFactory.Label(tilesRoot, best >= 100 ? "OK" : $"{best}%", x, y + 34,
                            22, best >= 100 ? 0xa5d6a7u : 0x8a93a8u);
                }
                pageText.text = pages > 1 ? $"page {page + 1} / {pages}" : "";
            }

            if (pages > 1)
            {
                UiFactory.TextButton(rt, "<", 210, 1280 - 165, 32, 0xffffff, 0x232b3e, () =>
                {
                    page = Mathf.Max(0, page - 1);
                    RenderPage();
                }, 80, 70);
                UiFactory.TextButton(rt, ">", 510, 1280 - 165, 32, 0xffffff, 0x232b3e, () =>
                {
                    page = Mathf.Min(pages - 1, page + 1);
                    RenderPage();
                }, 80, 70);
            }
            UiFactory.TextButton(rt, "CLOSE", 360, 1280 - 80, 34, 0xef9a9a, 0x331e1e, () =>
            {
                Destroy(_gridOverlay);
                _gridOverlay = null;
            });
            RenderPage();
        }
    }
}
