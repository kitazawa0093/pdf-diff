# PDF Diff

請求書 PDF をページ単位・文字単位で比較し、差分をマーカー表示するオフラインデスクトップアプリです。

- **技術**: Tauri 2 + React + TypeScript + pdf.js
- **比較**: A のページ順を基準に、未使用の B のうち一致率が最も高いページとペア（閾値未満は B に無し／残り B は追加）。各ペア内は 1 文字単位で diff
- **表示**: 旧 PDF（A）= 赤（削除）、新 PDF（B）= 緑（追加）

## 必要環境

| ツール | 用途 |
|--------|------|
| [Node.js](https://nodejs.org/) 20+ | フロントエンド |
| [Rust](https://www.rust-lang.org/tools/install) | Tauri ビルド |
| macOS: Xcode CLT | `xcode-select --install` |
| Windows ビルド時 | Visual Studio Build Tools |

## セットアップ

```bash
cd pdf-diff
npm install
```

### ブラウザのみで試す（Tauri なし）

```bash
npm run dev
```

http://localhost:1420 を開き、PDF A / B を選択して「比較」。

**まず Web 版だけ公開する手順** → [docs/WEB_FIRST.md](docs/WEB_FIRST.md)

### Tauri デスクトップで起動（Mac）

```bash
npm run tauri dev
```

初回は Rust のコンパイルに数分かかることがあります。

## Windows 用ビルド

Mac 上では Windows 向け exe の直接ビルドは難しいため、**GitHub Actions** または **Windows PC** でビルドするのが一般的です。

### ローカル（Windows）

```bash
npm install
npm run tauri build
```

成果物: `src-tauri/target/release/bundle/`

### GitHub Actions 例

`.github/workflows/build.yml` を追加し、`windows-latest` で `npm run tauri build` を実行。

## アイコン

`src-tauri/icons/` にアイコンが必要です。1024x1024 の PNG を用意して:

```bash
npm run tauri icon path/to/icon.png
```

## 使い方

1. **PDF A（旧）** … 変更前の請求書
2. **PDF B（新）** … 変更後の請求書
3. **比較** … ページ一覧に差分文字数が表示されます
4. ページを選ぶと左右にプレビューとマーカーが表示されます

## 無料版 / Pro 版

| | 無料（GitHub） | Pro（BOOTH） |
|---|----------------|--------------|
| ページ数 | 各 PDF **3 ページまで** | 無制限 |
| 有効化 | — | 購入後メールの **パスワード** をアプリで入力 |

配布用ビルド（パスワード・BOOTH URL を埋め込む）:

```bash
VITE_PRO_PASSWORD='あなたが決めた共通パスワード' \
VITE_BOOTH_URL=https://your-shop.booth.pm/items/xxxx \
npm run tauri build
```

開発中のみ、パスワード未設定時は `pdf-diff-dev-pro` で試せます。

BOOTH 購入者へのメール例: 「Pro 版パスワード: ○○○○（アプリの Pro版パスワード から入力）」

### 「開発承ります」表示（任意）

`.env` またはビルド時に指定すると、画面下部に小さくリンクが出ます（未設定なら非表示）。

```bash
VITE_CONTACT_EMAIL=you@example.com
# または
VITE_COMMISSION_URL=https://your-contact-page.example
VITE_COMMISSION_LABEL=開発のご相談を承ります
```

GitHub README / BOOTH 商品説明にも同じ連絡先を書いておくとよいです。

### Web 版に「有料ダウンロード版はこちら」

ブラウザで公開するとき、画面下部に窓の杜風の導線を出せます（Tauri 版では非表示）。

```bash
VITE_PAID_DOWNLOAD_URL=https://your-shop.booth.pm/items/xxxx
VITE_FREE_DOWNLOAD_URL=https://github.com/you/pdf-diff/releases
```

`VITE_PAID_DOWNLOAD_URL` を省略すると `VITE_BOOTH_URL` が使われます。

### Web 版 + デスクトップ版（実装済みの流れ）

| 版 | 使い方 |
|----|--------|
| **Web** | `npm run build` → GitHub Pages（`.github/workflows/deploy-web.yml`） |
| **DL 導線** | Web 画面下部: 無料 DL（GitHub Releases）・有料 DL（BOOTH） |
| **デスクトップ** | `npm run tauri build`（Web と同じ React、Tauri で包装） |
| **Pro** | どの版も「Pro版パスワード」で解除（3ページ制限なし） |

GitHub リポジトリの **Settings → Secrets and variables → Actions** に `vars` / `secrets` を登録すると Pages ビルドに反映されます（`VITE_BOOTH_URL`, `VITE_FREE_DOWNLOAD_URL`, `secrets.VITE_PRO_PASSWORD` など）。

公開 URL 例: `https://<ユーザー>.github.io/<リポジトリ名>/`

## 注意（請求書向け）

- テキストは pdf.js で抽出しています。読み取り順は **上→下、左→右** です。
- **スキャン画像のみの PDF** は文字比較できません。
- 表レイアウトが大きく変わると、見た目は同じでも差分が多く出ることがあります。
- 正規化は行っていません（1文字でも差分になります）。

## プロジェクト構成

```
src/
  lib/          # PDF 抽出・diff ロジック
  components/   # ページビューア
src-tauri/      # Tauri (Rust)
```
