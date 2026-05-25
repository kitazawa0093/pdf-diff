# まず Web 版を公開する手順

## 前提

- ビルド済み: `npm run build` → `dist/`
- 設定: プロジェクト直下の `.env.local`（Git に上げない）
- デプロイ: GitHub Pages（`.github/workflows/deploy-web.yml`）

## 1. GitHub にリポジトリを作る

例: `pdf-diff`（public 推奨）

## 2. 初回 push

```bash
cd pdf-diff
git init
git add .
git commit -m "Initial commit: PDF Diff web"
git branch -M main
git remote add origin git@github.com:<ユーザー名>/pdf-diff.git
git push -u origin main
```

## 3. GitHub Pages を有効化

1. リポジトリ → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. `main` に push すると **Deploy Web** ワークフローが走る

初回デプロイが 404 で落ちたとき → [GITHUB_PAGES_CHECKLIST.md](./GITHUB_PAGES_CHECKLIST.md)

公開 URL（例）: `https://<ユーザー名>.github.io/pdf-diff/`

## 4. Actions の Variables / Secrets（推奨）

**Settings → Secrets and variables → Actions**

| 種別 | 名前 | 例 |
|------|------|-----|
| Variable | `VITE_CONTACT_EMAIL` | kitazawa0093@gmail.com |
| Variable | `VITE_COMMISSION_LABEL` | 開発のご相談を承ります |
| Variable | `VITE_BOOTH_URL` | BOOTH 商品 URL |
| Variable | `VITE_FREE_DOWNLOAD_URL` | GitHub Releases URL（PC版準備後） |
| Variable | `VITE_WEB_APP_URL` | `https://<ユーザー>.github.io/pdf-diff/` |
| Secret | `VITE_PRO_PASSWORD` | Pro 用パスワード（購入者と同じ） |

未設定でもデプロイは動きます（該当リンク・Pro は無効 or 開発用のみ）。

## 5. ローカルで本番確認（任意）

```bash
npm run build
npx vite preview --port 4173
```

→ http://localhost:4173

## 6. 公開後チェック

- [ ] 3ページ超で Pro バナーが出る
- [ ] Pro版パスワードで解除できる
- [ ] 下部に PC 版 DL / BOOTH リンク
- [ ] 開発相談メールリンク
- [ ] 日本語 PDF で文字化けしない

## 次のステップ（後回しで可）

- GitHub Releases に無料 PC 版 → [SELL_FLOW.md](./SELL_FLOW.md)
- BOOTH 商品作成 → [SELL_FLOW.md](./SELL_FLOW.md)
