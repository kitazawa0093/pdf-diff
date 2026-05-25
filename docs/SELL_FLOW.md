# 売り出すまでの手順（秀丸方式）

無料: GitHub Releases / 有料: BOOTH（パスワード配布、1本買い切り）

## 全体像

| 配布 | 中身 | 値段 |
|------|------|------|
| **Web 版** | `https://kitazawa0093.github.io/pdf-diff/`（同じバイナリ） | 無料／パスワードで全機能 |
| **無料 PC 版** | GitHub Releases の dmg / msi（パスワード未入力で 3 ページ制限） | 無料 |
| **Pro 版** | 上の PC 版 + 「Pro パスワード」 | 1,000 円（BOOTH） |

**バイナリは 1 種類だけ。** Pro かどうかはパスワードで切り替わります。

---

## A. PC 版を GitHub Releases に出す

### 1. バージョンを決める

`src-tauri/tauri.conf.json` の `"version"` と `package.json` の `"version"` を揃える（初回は `0.1.0` のままで OK）。

### 2. タグを打って push

```bash
git tag v0.1.0
git push --tags
```

これで `.github/workflows/release.yml` が走り、Win / macOS バイナリが **Draft Release** として作られます。

### 3. Release を公開

1. https://github.com/kitazawa0093/pdf-diff/releases
2. Draft の `v0.1.0` を開く
3. 説明文を書く（例: 初回リリース・3ページ無料・Pro はパスワードで解除）
4. **Publish release**

### 4. ダウンロード URL を反映

Releases ページの URL を Actions Variable に入れる:

- `VITE_FREE_DOWNLOAD_URL` = `https://github.com/kitazawa0093/pdf-diff/releases/latest`

→ Deploy Web を再実行（または空コミット push）すると、Web 版下部 DL リンクが本物になります。

---

## B. BOOTH で売る

### 1. アカウント作成

https://booth.pm/ → メールで登録 → ショップ名（例: `kitazawa0093`）

**振込先口座** を登録すれば売上が入ります。販売手数料は 5.6% + 22円/件（pixiv 連携で安くなる）。

### 2. 商品ページを作る

- **カテゴリ**: ソフトウェア → ユーティリティ など
- **タイトル例**: `PDF Diff Pro パスワード（請求書の差分比較ツール）`
- **価格**: 1,000 円（買い切り）
- **商品説明**（例）:

  ```
  請求書 PDF をページ・文字単位で比較するデスクトップアプリ「PDF Diff」の
  Pro パスワードです。

  ▼ 無料版との違い
  ・無料版: 各 PDF 3 ページまで
  ・Pro 版: ページ数無制限

  ▼ 使い方
  1) 無料版をダウンロード
     https://github.com/kitazawa0093/pdf-diff/releases/latest
  2) 起動して「Pro 版パスワード」欄に、商品ファイルに記載のパスワードを入力
  3) すべてのページが解除されます（次回起動時は自動で解除済み）

  ▼ Web 版でも使えます
  https://kitazawa0093.github.io/pdf-diff/

  ▼ 動作環境
  ・Windows 10 以降 / macOS 12 以降
  ・オフライン動作（PDF は端末から外に出ません）

  ▼ サポート
  kitazawa0093@gmail.com
  ```

- **商品画像**: スクリーンショット3枚くらい（比較画面・Pro 解除ダイアログ・結果表示）

### 3. 商品ファイル

- `pdf-diff-pro-password.txt` を作って中身に **`kitazawa0093`** だけ書く  
- BOOTH 管理画面 → 商品 → ダウンロード商品ファイル に upload
- 「自動ダウンロード販売」を ON

### 4. 商品 URL を反映

公開後の URL を Actions Variable に入れる:

- `VITE_BOOTH_URL` = `https://kitazawa0093.booth.pm/items/XXXXXX`

→ Deploy Web 再実行。Web 版下部の「有料 PC 版はこちら」が本物の BOOTH に飛びます。

---

## C. 告知（やる場合）

- **X（Twitter）**: Web 版 URL とスクショ
- **note** または **Qiita**: 開発記事
- **窓の杜 / VECTOR**: 編集部にメール（任意。掲載は編集部判断）

---

## D. パスワードを変えたいとき

将来パスワードが流出した・気になる場合:

1. GitHub の Secret `VITE_PRO_PASSWORD` を新しい値に
2. `.env.local` も同じ値に（ローカルテスト用）
3. BOOTH の商品ファイルを差し替え
4. タグ打ち直し or Deploy Web 再実行
5. 既存購入者へ BOOTH メッセージ機能で新パスワードを連絡（人数少ない前提）

---

## E. よくある詰まりどころ

- **Windows SmartScreen 警告**: 署名証明書を買わない場合は出ます。「詳細情報 → 実行」で動きます。README に書いておくと親切。
- **macOS「開発元が未確認」**: 右クリック → 開く で初回起動。Apple Developer 登録（年 $99）すれば消せます。
- **Release ビルド失敗**: Actions ログを見て、`VITE_PRO_PASSWORD` が Secrets に入ってないと「未設定」のままビルドされる点に注意（PC 版の方）。
