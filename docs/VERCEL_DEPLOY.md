# Deploy na Vercel

Este projeto e um app Vite + React estatico que usa Supabase como backend. A Vercel deve servir o build da pasta `dist` e o Supabase continua responsavel por Auth, banco, RLS e Edge Functions.

## Premissas

- O deploy da interface sera feito na Vercel.
- O projeto Supabase ativo e o `objvdyjnryvllvadglns`.
- As Edge Functions do Supabase ja devem estar publicadas no projeto Supabase.
- O gerenciador recomendado para deploy e `npm`, porque existe `package-lock.json`.

## Checklist rapido

1. Rodar `npm run build` localmente.
2. Criar/importar o projeto na Vercel como Vite.
3. Configurar as variaveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` na Vercel.
4. Adicionar a URL final da Vercel no Supabase Auth.
5. Testar login, selecao de empresa, cadastro de divida e calculo de amortizacao.

## Variaveis de ambiente

Configure na Vercel, em Production e Preview:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Use os valores do seu `.env` local. Nao cole `SUPABASE_SERVICE_ROLE_KEY` nem qualquer chave secreta na interface Vite.

Se `.env` aparecer como arquivo rastreado pelo Git, remova-o do versionamento sem apagar o arquivo local:

```sh
git rm --cached .env
git commit -m "chore: remove env local do repositorio"
```

## Deploy pelo dashboard da Vercel

1. Suba o repositorio para o GitHub.
2. Na Vercel, clique em `Add New...` > `Project`.
3. Importe o repositorio.
4. Confira as configuracoes:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: automatico ou `npm install`
5. Adicione as variaveis de ambiente.
6. Clique em `Deploy`.

## Deploy pelo CLI

Use o script guardrail do projeto. Ele puxa as variaveis de Production da
Vercel, valida que as chaves do Supabase nao estao vazias, confere se o bundle
gerado contem o project ID esperado e so entao publica o build prebuilt:

```sh
npm run deploy:prod
```

Para validar apenas as variaveis puxadas da Vercel:

```sh
npx vercel@latest pull --yes --environment=production
npm run verify:prod-env
```

Para validar apenas o artefato ja gerado em `.vercel/output`:

```sh
npm run verify:vercel-output
```

Nao use `npx vercel@latest --prod` nem `npx vercel@latest build --prod`
manualmente neste projeto. O app Vite embute `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` no bundle; se a
Vercel devolver essas variaveis vazias, o React quebra antes de montar a tela.

### Primeiro setup

Sem instalar globalmente:

```sh
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env add VITE_SUPABASE_URL production
npx vercel@latest env add VITE_SUPABASE_PUBLISHABLE_KEY production
npx vercel@latest env add VITE_SUPABASE_PROJECT_ID production
npx vercel@latest env add VITE_SUPABASE_URL preview
npx vercel@latest env add VITE_SUPABASE_PUBLISHABLE_KEY preview
npx vercel@latest env add VITE_SUPABASE_PROJECT_ID preview
npm run deploy:prod
```

Para um deploy de preview, use:

```sh
npx vercel@latest
```

## Supabase Auth depois do deploy

No painel do Supabase, abra `Authentication` > `URL Configuration`.

Configure:

- Site URL: URL de producao da Vercel, por exemplo `https://seu-dominio.com`.
- Redirect URLs:
  - `http://localhost:8080/**`
  - URL de producao, por exemplo `https://seu-dominio.com/**`
  - Previews da Vercel, se voce for usar previews: `https://*-<team-or-account-slug>.vercel.app/**`

O app usa `window.location.origin` no cadastro, entao a origem do deploy precisa estar permitida no Supabase.

## Validacao pos-deploy

1. Abra a URL da Vercel em uma aba anonima.
2. Faca login com um usuario autorizado.
3. Confirme se a empresa ativa aparece.
4. Abra o dashboard e confira se as consultas retornam dados da empresa.
5. Cadastre ou edite uma divida de teste.
6. Gere amortizacao e confirme que a Edge Function `calculate-amortization` responde.
7. Abra uma rota diretamente, como `/auth`, para confirmar que o fallback SPA funciona.
