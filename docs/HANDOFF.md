# HANDOFF — 勝率カウンター

## 現状

- Expo + React Native + TypeScriptでMVP実装を追加。
- SQLite保存、写真登録、履歴、アーカイブ、設定、ウィジェット枠、Swift WidgetKit連携を実装。
- 設定画面内でアプリアイコン `icon1`〜`icon4` を遷移なしで選択可能。iOS代替アイコン用に `assets/icon2.png`〜`assets/icon4.png` も採用済み。
- Expo Configは `app.config.js` に一本化済み。`app.json` は削除済み。
- TestFlight起動時の白画面対策として、`expo-font@14.0.12` を明示依存に追加し、`@expo/vector-icons` のNative Module/Font依存重複を解消済み。
- 型チェック、SDK依存チェック、iOS export、clean prebuild、autolinking、npm auditを確認済み。
- GitHub Actions / fastlane matchによるTestFlight配信設定を追加。
- 2026-07-06 18:29 JST頃に `iOS TestFlight` workflowを手動実行し、run `28781717615` は成功。
- アプリ名は「勝率カウンター」。
- 海外向け展開は後回し。

## 確定事項

- 勝ち/負けのみ。引き分けは後回し。
- 勝率は `wins / (wins + losses)`。
- 複数カウンター対応。
- カウンターは名前と写真を登録可能。
- 写真はライブラリ選択とカメラ撮影に対応。
- 履歴を保存し、履歴ページで全体表示とカウンター絞り込みを行う。
- 履歴から個別削除可能。
- 直前の取り消しはアプリ内のみ。
- カウンター削除はアーカイブ扱い。
- アーカイブ済みカウンターは通常一覧・履歴には表示しない。
- 設定から復元、完全削除、データ全削除が可能。
- ホーム画面ウィジェットはsmall/medium。
- ロック画面ウィジェットはrectangular。
- ウィジェットには写真を出さない。
- ウィジェットはアプリ内の枠1〜3にカウンターを割り当て、ウィジェット設定で枠を選ぶ。
- SDK 54固定のため、`expo-widgets` は使わず、`@bacons/apple-targets` + Swift WidgetKit + App Group共有で実装。
- ウィジェット表示スナップショットは App Group のJSONファイルを優先し、`UserDefaults` もフォールバックとして併用する。
- ウィジェット記録後の即時反映は最重要仕様。
- ライト/ダーク両対応。
- 初回は作成画面へ自動遷移せず、空状態で「名前と写真のみ、写真は任意」と説明してから作成ボタンを出す。
- カウンター画面の並び順は登録順。

## 次タスク

1. TestFlightビルドを実機で確認する。
2. 枠1にカウンターを割り当て、ホーム画面/ロック画面ウィジェットが「カウンターなし」ではなく対象カウンターを表示するか確認する。
3. ウィジェットから勝ち/負けを記録し、Widget表示とアプリ履歴へ反映されるか確認する。
4. 設定画面のアプリアイコン選択UI、履歴画面の上揃え、作成導線を実機で再確認する。
5. 問題がなければストアスクリーンショットを作成する。

## 既知の注意点

- ウィジェットからの記録は、共有ストレージ更新とWidgetKit再読み込みの体感速度が品質を左右する。
- 「ウィジェット同期に失敗しました / App Groupの設定を確認してください」が出た場合、App Group共有コンテナを実機で開けていない。Apple Developerの本体App ID/Widget App ID両方にApp Groups capabilityと `group.com.sknkaaa.wintrack` を付け、`iOS Certificates (one-time setup)` でmatch profileを強制再生成してからTestFlightを再実行する。
- `iOS TestFlight` は署名済みentitlementsとembedded provisioning profileの両方にApp Groupが含まれるか検査する。
- レイアウト寸法は実装後に実機確認で調整する。
- `APPLE_TEAM_ID` はGitHub Secretsから `app.config.js` 経由でExpo Configへ注入する。
- TestFlightで再度白画面が出る場合は、次は推測修正ではなくGitHub ActionsのビルドログとTestFlight/端末クラッシュログを確認する。
- 代替アプリアイコンは App Store Connect で `90032 Invalid Image Path` が出たため、asset catalogだけでなく `AppIcon*-60@2x/@3x.png` をバンドルResourcesへ入れるconfig pluginに修正済み。
- ローカル `npx expo prebuild --platform ios --no-install` では `APPLE_TEAM_ID` 未設定警告が出ることがある。CIではSecret注入前提。
