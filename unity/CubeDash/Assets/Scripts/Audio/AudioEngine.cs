using System.Collections.Generic;
using CubeDash.Logic;
using UnityEngine;

namespace CubeDash.Audio
{
    /// <summary>
    /// Port of @mg/core's WebAudio synth stack (MusicPlayer 16-step sequencer +
    /// sfx blips) as a single OnAudioFilterRead DSP graph: kick = pitch-swept
    /// sine, hat = high-passed noise, bass = low-passed saw, lead = square with
    /// a feedback delay. Zero audio assets, same patterns per world.
    /// </summary>
    public sealed class AudioEngine : MonoBehaviour
    {
        private static AudioEngine _instance;

        public static AudioEngine I
        {
            get
            {
                if (_instance == null)
                {
                    var go = new GameObject("audio-engine");
                    DontDestroyOnLoad(go);
                    var src = go.AddComponent<AudioSource>();
                    src.playOnAwake = false;
                    src.spatialBlend = 0f;
                    _instance = go.AddComponent<AudioEngine>();
                    src.Play(); // no clip: pure procedural generation
                }
                return _instance;
            }
        }

        private const float MusicVolume = 0.12f;

        private readonly object _lock = new();
        private readonly List<Voice> _voices = new(64);
        private int _rate = 48000;

        private MusicPattern _pattern;
        private bool _musicOn;
        private double _stepSamples;
        private double _samplesToNextStep;
        private int _step;

        // Lead feedback delay (0.75 of a beat, feedback 0.3).
        private float[] _delayBuf;
        private int _delayLen = 1, _delayPos;

        private void Awake()
        {
            _rate = AudioSettings.outputSampleRate;
            _delayBuf = new float[_rate * 2];
        }

        public void PlayMusic(MusicPattern pattern)
        {
            lock (_lock)
            {
                _pattern = pattern;
                _stepSamples = _rate * 60.0 / pattern.Bpm / 4.0; // 16th notes
                _samplesToNextStep = 0;
                _step = 0;
                _delayLen = Mathf.Clamp((int)(60.0 / pattern.Bpm * 0.75 * _rate), 1, _delayBuf.Length);
                System.Array.Clear(_delayBuf, 0, _delayBuf.Length);
                _musicOn = true;
            }
        }

        public void StopMusic()
        {
            lock (_lock) _musicOn = false;
        }

        public bool MusicPlaying
        {
            get { lock (_lock) return _musicOn; }
        }

        // --- sfx (same moments as the web build's sfx calls) ---
        public void Jump() => Blip(Wave.Square, 280, 280, 0.5f, 0.07f);
        public void Land() => Blip(Wave.Square, 140, 140, 0.35f, 0.05f);
        public void AirJump() => Blip(Wave.Square, 440, 660, 0.5f, 0.09f);
        public void Collect()
        {
            Blip(Wave.Sine, 660, 660, 0.5f, 0.09f);
            Blip(Wave.Sine, 880, 880, 0.5f, 0.12f, 0.07f);
        }
        public void Death() => Blip(Wave.Saw, 300, 70, 0.6f, 0.3f);
        public void Complete()
        {
            float[] notes = { 523.25f, 659.25f, 783.99f, 1046.5f };
            for (int i = 0; i < notes.Length; i++)
                Blip(Wave.Square, notes[i], notes[i], 0.4f, 0.14f, i * 0.09f);
        }
        public void Click() => Blip(Wave.Square, 500, 500, 0.25f, 0.04f);

        private void Blip(Wave wave, float f0, float f1, float peak, float durSec, float delaySec = 0)
        {
            var v = new Voice
            {
                Type = VoiceType.Sfx,
                Wave = wave,
                F0 = f0,
                F1 = f1,
                Peak = peak,
                DurSamples = (int)(durSec * _rate),
                StartIn = (int)(delaySec * _rate),
            };
            lock (_lock) _voices.Add(v);
        }

        private void ScheduleStep(int step)
        {
            var p = _pattern;
            if (p.Kick.Length > step && p.Kick[step])
                _voices.Add(new Voice { Type = VoiceType.Kick, Peak = 1f, DurSamples = (int)(0.15f * _rate) });
            if (p.Hat.Length > step && p.Hat[step])
                _voices.Add(new Voice { Type = VoiceType.Hat, Peak = 0.25f, DurSamples = (int)(0.05f * _rate) });
            if (p.Bass.Length > step && p.Bass[step] is double bass)
                _voices.Add(new Voice { Type = VoiceType.Bass, F0 = (float)bass, Peak = 0.5f, DurSamples = (int)(0.13f * _rate) });
            if (p.Lead.Length > step && p.Lead[step] is double lead)
                _voices.Add(new Voice { Type = VoiceType.Lead, F0 = (float)lead, Peak = 0.16f, DurSamples = (int)(0.17f * _rate) });
        }

        private void OnAudioFilterRead(float[] data, int channels)
        {
            lock (_lock)
            {
                int frames = data.Length / channels;
                for (int f = 0; f < frames; f++)
                {
                    if (_musicOn)
                    {
                        _samplesToNextStep -= 1;
                        if (_samplesToNextStep <= 0)
                        {
                            ScheduleStep(_step);
                            _step = (_step + 1) % 16;
                            _samplesToNextStep += _stepSamples;
                        }
                    }

                    float music = 0f, sfx = 0f, leadSend = 0f;
                    for (int i = _voices.Count - 1; i >= 0; i--)
                    {
                        var v = _voices[i];
                        if (v.StartIn > 0)
                        {
                            v.StartIn--;
                            continue;
                        }
                        float s = v.Render(_rate, out bool done);
                        if (v.Type == VoiceType.Sfx) sfx += s;
                        else music += s;
                        if (v.Type == VoiceType.Lead) leadSend += s;
                        if (done) _voices.RemoveAt(i);
                    }

                    // Feedback delay on the lead bus.
                    float echoed = _delayBuf[_delayPos];
                    _delayBuf[_delayPos] = leadSend + echoed * 0.3f;
                    _delayPos = (_delayPos + 1) % _delayLen;

                    float sample = (music + echoed) * MusicVolume + sfx * 0.09f;
                    sample = Mathf.Clamp(sample, -1f, 1f);
                    for (int c = 0; c < channels; c++)
                        data[f * channels + c] += sample;
                }
            }
        }

        private enum VoiceType { Kick, Hat, Bass, Lead, Sfx }
        private enum Wave { Sine, Square, Saw }

        private sealed class Voice
        {
            public VoiceType Type;
            public Wave Wave;
            public float F0, F1;
            public float Peak;
            public int DurSamples;
            public int StartIn;

            private int _t;
            private double _phase;
            private float _lp, _hpPrevIn, _hpPrevOut;
            private uint _noise = 22222;

            public float Render(int rate, out bool done)
            {
                float progress = (float)_t / DurSamples;
                done = _t++ >= DurSamples;
                if (done) return 0f;
                // Exponential-ish decay envelope (WebAudio exponentialRamp to ~0).
                float env = Peak * Mathf.Pow(0.001f, progress);

                switch (Type)
                {
                    case VoiceType.Kick:
                    {
                        // 150 Hz sweeping down to 40 Hz over 100 ms.
                        float k = Mathf.Min(1f, _t / (0.1f * rate));
                        float freq = 150f * Mathf.Pow(40f / 150f, k);
                        _phase += freq / rate;
                        return env * Mathf.Sin((float)(_phase * 2 * Mathf.PI));
                    }
                    case VoiceType.Hat:
                    {
                        // White noise through a one-pole highpass at 7 kHz.
                        _noise = _noise * 1664525u + 1013904223u;
                        float x = (_noise >> 9) / 4194304f - 1f;
                        float rc = 1f / (2f * Mathf.PI * 7000f);
                        float a = rc / (rc + 1f / rate);
                        float y = a * (_hpPrevOut + x - _hpPrevIn);
                        _hpPrevIn = x;
                        _hpPrevOut = y;
                        return env * y;
                    }
                    case VoiceType.Bass:
                    {
                        // Saw through a one-pole lowpass at 500 Hz.
                        _phase += F0 / rate;
                        float saw = 2f * (float)(_phase - System.Math.Floor(_phase + 0.5));
                        float rc = 1f / (2f * Mathf.PI * 500f);
                        float b = (1f / rate) / (rc + 1f / rate);
                        _lp += b * (saw - _lp);
                        return env * _lp;
                    }
                    case VoiceType.Lead:
                    {
                        _phase += F0 / rate;
                        return env * (System.Math.Sin(_phase * 2 * System.Math.PI) >= 0 ? 1f : -1f);
                    }
                    default: // Sfx
                    {
                        float freq = Mathf.Lerp(F0, F1, progress);
                        _phase += freq / rate;
                        return Wave switch
                        {
                            Wave.Sine => env * Mathf.Sin((float)(_phase * 2 * Mathf.PI)),
                            Wave.Saw => env * 2f * (float)(_phase - System.Math.Floor(_phase + 0.5)),
                            _ => env * (System.Math.Sin(_phase * 2 * System.Math.PI) >= 0 ? 1f : -1f),
                        };
                    }
                }
            }
        }
    }
}
