# Phase 0 — Accounts & Toolchain Setup (your action items)

These are the steps only you can do (payments, identity verification, GUI installers).
Everything else in the pipeline is automated. Do the account signups **first** —
identity verification can take days and runs in parallel with development.

## 1. Google Play Console — $25 one-time
1. Go to https://play.google.com/console/signup
2. Sign in with the Google account you want to own the games (consider a dedicated one, e.g. a "studio" Gmail — the developer name is public).
3. Choose **Personal** account type, pay $25, complete identity verification (government ID, can take 1–3 days).
4. ⚠️ Heads-up: new personal accounts must run a **closed test with 12 testers opted in for 14 consecutive days for each app** before production release. Start thinking about 12 friends/family with Android phones — we'll send them an opt-in link when the first build is up.

## 2. Apple Developer Program — $99/year
1. Go to https://developer.apple.com/programs/enroll/
2. Enroll as an **Individual** with your Apple ID (two-factor auth required). Approval usually < 48h.
3. Install **Xcode** from the Mac App Store (large download — start it early). After install, run it once and accept the license.

## 3. AdMob — free
1. Go to https://admob.google.com and sign up with the same Google account as Play Console.
2. Complete payment details and tax info (needed before any payout).
3. Don't create apps/ad units yet — we do that together at launch time. Until then the games use Google's public **test ad IDs** (already wired in).

## 4. Local toolchain (one command, ~30 min of downloads)
Homebrew needs your admin password, so run this yourself in a terminal:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install --cask android-studio temurin
brew install cocoapods
xcode-select --install   # if Xcode from step 2 isn't installed yet
```

Then open Android Studio once → More Actions → SDK Manager → install the default SDK + build tools it suggests.

Also add Node to your PATH permanently (it's installed at `~/.local/node` already):

```sh
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
```

## 5. Privacy-policy hosting — free
A public privacy policy URL is mandatory for both stores and AdMob. Easiest: a GitHub account + GitHub Pages repo (I generate all the content, you create the repo and enable Pages — 5 minutes). A custom domain is optional polish.

## Status checklist
- [ ] Play Console account verified
- [ ] 12 Android testers lined up (names/emails)
- [ ] Apple Developer enrolled
- [ ] Xcode installed & opened once
- [ ] AdMob account + payment/tax info
- [ ] Homebrew + Android Studio + CocoaPods installed
- [ ] Node on PATH in ~/.zshrc
- [ ] GitHub Pages repo for privacy policy
