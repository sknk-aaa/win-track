# OPERATIONS — 勝率カウンター

## 環境

- iOSアプリ。
- Expo SDK 54 + React Native + TypeScript。
- iOS WidgetKit拡張を使う。
- ウィジェット拡張は `@bacons/apple-targets` でCNG生成する。
- アプリ/ウィジェット間の共有は App Group のJSONファイルで行う。
- GitHub Actionsによるビルド/配信は親プロジェクトの共通docに従う。

## 未設定

- bundle identifier: `com.sknkaaa.wintrack`
- widget bundle identifier: `com.sknkaaa.wintrack.widgets`
- App Group identifier: `group.com.sknkaaa.wintrack`
- Apple Team ID
- GitHub Actions workflow
- fastlane match設定
- Secrets

`@bacons/apple-targets` は `ios.appleTeamId` 未設定だとprebuild時に警告を出す。値は秘密/運用値なのでコードへ直書きせず、親プロジェクトのCI/CD設定に合わせて設定する。

## Secrets

現時点では未定。`.env`、秘密鍵、APIキー、トークン、認証情報はコミット禁止。

## ビルド/配信

このリポには手順を重複して書かない。親プロジェクトのiOS CI/CD手順を参照する。
