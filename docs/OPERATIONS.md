# OPERATIONS — 勝率カウンター

## 環境

- iOSアプリ。
- Expo SDK 54 + React Native + TypeScript。
- iOS WidgetKit拡張を使う。
- ウィジェット拡張は `@bacons/apple-targets` でCNG生成する。
- アプリ/ウィジェット間の共有は App Group のJSONファイルで行う。
- GitHub Actionsによるビルド/配信は親プロジェクトの共通docに従う。
- GitHub Actionsはfastlane matchでアプリ本体とWidget拡張のApp Store用Profileを管理する。

## 識別子

- bundle identifier: `com.sknkaaa.wintrack`
- widget bundle identifier: `com.sknkaaa.wintrack.widgets`
- App Group identifier: `group.com.sknkaaa.wintrack`

`APPLE_TEAM_ID` はGitHub Secretsから `app.config.js` 経由でExpo Configへ注入する。コードへ直書きしない。

## Secrets

GitHub Actions Secrets:

- `APPLE_TEAM_ID`
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `MATCH_GIT_BASIC_AUTHORIZATION`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY`

`.env`、秘密鍵、APIキー、トークン、認証情報はコミット禁止。

## ビルド/配信

1. App Store Connect / Apple Developerで本体Bundle ID、Widget Bundle ID、App Groupを作成する。
2. GitHub Secretsを登録する。
3. Actionsの `iOS Certificates (one-time setup)` を初回1回実行する。
4. Actionsの `iOS TestFlight` を実行する。
5. TestFlightでWidgetKit拡張とApp Groupの即時反映を実機確認する。

詳細な汎用手順は親プロジェクトのiOS CI/CD手順を参照する。
