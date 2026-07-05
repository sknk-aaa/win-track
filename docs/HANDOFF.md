# HANDOFF — 勝率カウンター

## 現状

- Expo + React Native + TypeScriptでMVP実装を追加。
- SQLite保存、写真登録、履歴、アーカイブ、設定、ウィジェット枠、Swift WidgetKit連携を実装。
- アプリアイコンは `assets/icon1.png` を使用。
- Expo Configは `app.config.js` に一本化済み。`app.json` は削除済み。
- TestFlight起動時の白画面対策として、`expo-font@14.0.12` を明示依存に追加し、`@expo/vector-icons` のNative Module/Font依存重複を解消済み。
- 型チェック、SDK依存チェック、iOS export、clean prebuild、autolinking、npm auditを確認済み。
- GitHub Actions / fastlane matchによるTestFlight配信設定を追加。
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
- SDK 54固定のため、`expo-widgets` は使わず、`@bacons/apple-targets` + Swift WidgetKit + App Group共有JSONで実装。
- ウィジェット記録後の即時反映は最重要仕様。
- ライト/ダーク両対応。

## 次タスク

1. 最新コミットをpushして、Actionsの `iOS TestFlight` を再実行する。
2. TestFlightで白画面が解消してアプリが起動するか確認する。
3. 起動確認後、WidgetKit拡張とApp Groupの即時反映を実機確認する。
4. 実機でホーム画面/ロック画面ウィジェットの記録導線を確認する。
5. ストアスクリーンショットを作成する。

## 既知の注意点

- ウィジェットからの記録は、共有ストレージ更新とWidgetKit再読み込みの体感速度が品質を左右する。
- レイアウト寸法は実装後に実機確認で調整する。
- `APPLE_TEAM_ID` はGitHub Secretsから `app.config.js` 経由でExpo Configへ注入する。
- TestFlightで再度白画面が出る場合は、次は推測修正ではなくGitHub ActionsのビルドログとTestFlight/端末クラッシュログを確認する。
- `assets/icon2.png`、`assets/icon3.png`、`assets/icon4.png` は未採用の候補素材。現時点では未追跡のまま。
