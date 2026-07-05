# OPERATIONS — 勝率カウンター

## 環境

- iOSアプリ。
- Expo + React Native + TypeScriptを想定。
- iOS WidgetKit拡張を使う。
- GitHub Actionsによるビルド/配信は親プロジェクトの共通docに従う。

## 未設定

- bundle identifier
- Apple Team ID
- App Group identifier
- GitHub Actions workflow
- fastlane match設定
- Secrets

## Secrets

現時点では未定。`.env`、秘密鍵、APIキー、トークン、認証情報はコミット禁止。

## ビルド/配信

このリポには手順を重複して書かない。親プロジェクトのiOS CI/CD手順を参照する。
