#!/bin/sh
# Xcode Cloud runs this straight after it clones the repo, before it builds.
#
# The Beyond Home phone app: a Capacitor shell around the phone build of
# beyond_home/web (vite --mode phone), bundled inside the app because the box
# is on the house network, not the internet. Xcode needs the files `cap sync`
# writes and git ignores, so this makes them.
set -e

# Xcode Cloud has Homebrew but no Node.
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"

cd "$CI_PRIMARY_REPOSITORY_PATH/beyond_home/web"
npm ci --no-audit --no-fund
npm run build:phone

cd "$CI_PRIMARY_REPOSITORY_PATH/app"
npm ci --no-audit --no-fund
npx cap sync ios

# cap sync rewrites Package.swift with Ionic's capacitor-swift-pm URL, but
# Xcode Cloud only reaches our fork (same 8.5.2 commit). Point it back.
sed -i '' 's#github.com/ionic-team/capacitor-swift-pm#github.com/YeahBuddyNZ/capacitor-swift-pm#' ios/App/CapApp-SPM/Package.swift
