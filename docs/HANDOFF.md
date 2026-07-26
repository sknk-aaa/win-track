# HANDOFF — 勝率カウンター

## 現状

- Expo + React Native + TypeScriptでMVP実装を追加。
- SQLite保存、写真登録、履歴、アーカイブ、設定、ウィジェット枠、Swift WidgetKit連携を実装。
- 設定画面内でアプリアイコン `icon1`〜`icon4` を遷移なしで選択可能。iOS代替アイコン用に `assets/icon2.png`〜`assets/icon4.png` も採用済み。
- Expo Configは `app.config.js` に一本化済み。`app.json` は削除済み。
- TestFlight起動時の白画面対策として、`expo-font@14.0.12` を明示依存に追加し、`@expo/vector-icons` のNative Module/Font依存重複を解消済み。
- 型チェック、SDK依存チェック、iOS export、clean prebuild、autolinking、npm auditを確認済み。
- GitHub Actions / fastlane matchによるTestFlight配信設定を追加。
- 2026-07-07 14:18 JST頃に `iOS TestFlight` workflowを手動実行し、run `28843434820` は成功。対象コミットは `01ccbb6`。
- 2026-07-10 19:45 JST頃に `iOS TestFlight` workflow run `29087332937` が成功。対象コミットは `7b11469`。
- 実機でWidget表示までは確認済み。Widgetから押した勝ち/負けがアプリのカウンター数値と履歴に取り込まれない問題に対して、`widget-events.json` に加えてスナップショット内 `pendingEvents` も取り込む修正を追加済み。
- 設定画面で勝敗表記を `勝/負` と `W/L` から選択できるようにし、アプリ内表示とWidget表示の両方へ反映する実装を追加済み。
- ロック画面Widgetの勝率が改行されないよう左カラムを優先しつつ、W/Lボタンは円形で押せる幅を確保する調整を追加。
- 設定画面では、勝敗表記切替をアプリアイコン直前へ移動。レビュー導線はアーカイブ下、データ全削除は最下部に配置。
- ウィジェット枠説明は、ホーム画面Widgetを3種類まで置けることを先に出し、ロック画面の枠1説明は括弧内で控えめに表示。
- 設定画面のセクションタイトルに、アプリの雰囲気に合わせた小さなアイコンを追加。
- プライマリアプリアイコンは `app.config.js` で `assets/icon1.png` を使用。
- アプリ本体の最新commit `7b11469` は `origin/main` へpush済みで、TestFlightビルドも成功済み。
- App Reviewで権限purpose string不足の自動却下が発生。Camera/Photo Libraryの用途文言を具体例付きに修正し、未使用のMicrophone権限文言は `expo-image-picker` configで追加しないようにした。
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
- 勝敗表記はアプリ内設定で `勝/負` または `W/L` を選び、Widgetスナップショットにも同じ設定値を含める。
- SDK 54固定のため、`expo-widgets` は使わず、`@bacons/apple-targets` + Swift WidgetKit + App Group共有で実装。
- ウィジェット表示スナップショットは App Group のJSONファイルと `UserDefaults` の両方を読み、`updatedAt` が新しい方を使う。
- アプリ側のカスタムブリッジ保存が失敗した場合は、`@bacons/apple-targets` の `ExtensionStorage` で `UserDefaults` 保存へフォールバックする。
- ウィジェット記録後の即時反映は最重要仕様。
- ライト/ダーク両対応。
- 初回は作成画面へ自動遷移せず、空状態で「名前と写真のみ、写真は任意」と説明してから作成ボタンを出す。
- カウンター画面の並び順は登録順。

## 次タスク

1. purpose string修正版をTestFlight/App Store Connectへアップロードし、同じ申請に新しいビルドを選び直して再提出する。
2. 提出前に、処理済みビルドのInfo.plistで `NSMicrophoneUsageDescription` が含まれず、Camera/Photo Libraryの文言が具体例付きになっていることを確認する。
3. 再提出後、審査ステータスと追加のApp Reviewメッセージを確認する。

## 既知の注意点

- ウィジェットからの記録は、共有ストレージ更新とWidgetKit再読み込みの体感速度が品質を左右する。
- Widget由来イベントは `widget-events.json` とスナップショット内 `pendingEvents` の両方から取り込み、イベントIDを `match_records.id` にして `INSERT OR IGNORE` するため二重加算を防ぐ。
- 「ウィジェット同期に失敗しました / App Groupの設定を確認してください」が出た場合、App Group共有コンテナを実機で開けていない。Apple Developerの本体App ID/Widget App ID両方にApp Groups capabilityと `group.com.sknkaaa.wintrack` を付け、`iOS Certificates (one-time setup)` でmatch profileを強制再生成してからTestFlightを再実行する。
- `iOS TestFlight` は署名済みentitlementsとembedded provisioning profileの両方にApp Groupが含まれるか検査する。
- レイアウト寸法は実装後に実機確認で調整する。
- `APPLE_TEAM_ID` はGitHub Secretsから `app.config.js` 経由でExpo Configへ注入する。
- TestFlightで再度白画面が出る場合は、次は推測修正ではなくGitHub ActionsのビルドログとTestFlight/端末クラッシュログを確認する。
- 代替アプリアイコンは App Store Connect で `90032 Invalid Image Path` が出たため、asset catalogだけでなく `AppIcon*-60@2x/@3x.png` をバンドルResourcesへ入れるconfig pluginに修正済み。
- ローカル `npx expo prebuild --platform ios --no-install` では `APPLE_TEAM_ID` 未設定警告が出ることがある。CIではSecret注入前提。
