# GitHub Pages 公開チェックリスト

初回 push 後、**Deploy Web** が `404` で落ちる場合は Pages が未設定です。

## 1. Pages を有効化（必須・1回だけ）

1. https://github.com/kitazawa0093/pdf-diff/settings/pages
2. **Build and deployment** → **Source**: **GitHub Actions** を選ぶ
3. 保存（表示が変われば OK）

## 2. Actions の Variables / Secrets（推奨）

https://github.com/kitazawa0093/pdf-diff/settings/secrets/actions

### Repository variables（Variables タブ）

| Name | Value |
|------|--------|
| `VITE_CONTACT_EMAIL` | `kitazawa0093@gmail.com` |
| `VITE_COMMISSION_LABEL` | `開発のご相談を承ります` |
| `VITE_WEB_APP_URL` | `https://kitazawa0093.github.io/pdf-diff/` |
| `VITE_BOOTH_URL` | BOOTH 商品 URL（準備できたら） |
| `VITE_FREE_DOWNLOAD_URL` | Releases URL（PC版準備後） |

### Repository secrets（Secrets タブ）

| Name | Value |
|------|--------|
| `VITE_PRO_PASSWORD` | 購入者に送る Pro パスワード（`.env.local` と同じ） |

## 3. 再デプロイ

Pages 有効化後:

1. https://github.com/kitazawa0093/pdf-diff/actions/workflows/deploy-web.yml
2. **Run workflow** → branch `main` → **Run workflow**

またはローカル:

```bash
git commit --allow-empty -m "chore: redeploy GitHub Pages"
git push
```

## 4. 公開確認

- URL: https://kitazawa0093.github.io/pdf-diff/
- 4ページ目で Pro バナー
- Pro パスワードで解除
- 下部 DL / 相談リンク
