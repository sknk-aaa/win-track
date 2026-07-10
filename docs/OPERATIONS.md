# OPERATIONS — 勝率カウンター

## 環境

- iOSアプリ。
- Expo SDK 54 + React Native + TypeScript。
- Expo Configは `app.config.js` を正とする。`app.json` は使わない。
- iOS WidgetKit拡張を使う。
- ウィジェット拡張は `@bacons/apple-targets` でCNG生成する。
- アプリ/ウィジェット間の共有は App Group のJSONファイルと `UserDefaults` で行う。表示スナップショットは両方を読み `updatedAt` が新しい方を使い、未同期イベントはJSONファイルとスナップショット内の `pendingEvents` から取り込む。カスタムブリッジ保存が失敗した場合は `@bacons/apple-targets` の `ExtensionStorage` で `UserDefaults` 保存へフォールバックする。
- GitHub Actionsによるビルド/配信は親プロジェクトの共通docに従う。
- GitHub Actionsはfastlane matchでアプリ本体とWidget拡張のApp Store用Profileを管理する。
- `@expo/vector-icons` を使うため、SDK54用の `expo-font@14.0.12` を明示依存に入れる。これを外すとTestFlight単体アプリで白画面になる可能性がある。
- 代替アプリアイコンは `plugins/withAlternateAppIcons.js` で生成/登録する。App Store Connect検証対策として、asset catalogだけでなく `AppIcon*-60@2x/@3x.png` をResourcesへ同梱する。

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

1. App Store Connect / Apple Developerで本体Bundle ID、Widget Bundle ID、App Groupを作成し、本体とWidgetの両方のApp IDでApp Groups capabilityを有効化して `group.com.sknkaaa.wintrack` を割り当てる。
2. GitHub Secretsを登録する。
3. Actionsの `iOS Certificates (one-time setup)` を実行し、App Store用provisioning profileを再生成してmatchリポへ保存する。App Groups capabilityを変更した後も必ず再実行する。
4. Actionsの `iOS TestFlight` を実行する。
5. TestFlightでWidgetKit拡張とApp Groupの即時反映を実機確認する。

詳細な汎用手順は親プロジェクトのiOS CI/CD手順を参照する。

## TestFlight確認

- アプリ内で「ウィジェット同期に失敗しました / App Groupの設定を確認してください」と出た場合、実機ビルドがApp Group共有コンテナを開けていない。Apple Developerで本体App IDとWidget App IDの両方にApp Groups capabilityと `group.com.sknkaaa.wintrack` が入っていることを確認し、`iOS Certificates (one-time setup)` でprofileを再生成してから `iOS TestFlight` を実行する。
- `iOS TestFlight` laneはIPA内の本体/Widgetそれぞれの署名済みentitlementsとembedded provisioning profileに `group.com.sknkaaa.wintrack` が入っていることを検査する。
- 白画面対策後の確認では、最新コミットをpushして `iOS TestFlight` を再実行する。
- 2026-07-06の `iOS TestFlight` workflow run `28781717615` は成功済み。
- 2026-07-07の `iOS TestFlight` workflow run `28843434820` は成功済み。対象コミットは `01ccbb6`。
- 2026-07-10の `iOS TestFlight` workflow run `29087332937` は成功済み。対象コミットは `7b11469`。
- Widget由来の記録反映は、Widgetで勝ち/負けを押した後にアプリを前面復帰させ、カウンター数値と履歴の両方に追加されるか確認する。
- `npx expo-doctor` はネットワーク起因のExpo API / React Native Directory接続失敗を除き、依存・設定エラーがない状態にする。
- 再度白画面が出る場合は、依存推測ではなくGitHub ActionsログとTestFlight/端末クラッシュログを確認する。
