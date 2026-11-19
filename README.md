# Relatório de Testes

Site estático (HTML, CSS e JS) que mostra o relatório de testes.
Os casos de teste ficam num banco **Supabase** (plano gratuito), e o site é publicado no **Vercel**.

| Arquivo | Para que serve |
|---|---|
| `index.html`, `style.css`, `script.js` | O site. O cabeçalho (projeto, ambiente, responsável, objetivo) fica no `index.html` |
| `config.js` | Endereço e chave pública do Supabase |
| `supabase/setup.sql` | Cria a tabela, as regras de acesso e a lista de editores no banco |
| `supabase/trocar_realizadores.sql` | Troca o usuário do Protheus pelo nome completo nos casos de teste |

> O **Período** em "Informações gerais" é calculado sozinho: vai da data mais antiga à mais recente dos casos de teste.

---

## 1. Criar o banco no Supabase (grátis)

1. Crie uma conta em <https://supabase.com> e clique em **New project**.
   - Escolha a região **South America (São Paulo)**.
   - Guarde a senha do banco num lugar seguro.
2. No menu lateral, abra o **SQL Editor** e clique em **New query**.
3. Cole todo o conteúdo de `supabase/setup.sql`.
4. **Na última parte do arquivo, troque `seu-email@exemplo.com` pelo seu e-mail.** Para cadastrar mais editores, repita a linha `insert` com outros e-mails.
5. Clique em **Run**.

## 2. Criar o usuário de quem vai editar

1. Abra **Authentication → Users → Add user → Create new user**.
2. Informe o mesmo e-mail cadastrado no passo anterior, defina uma senha e marque **Auto Confirm User**.
3. Em **Authentication → Sign In / Providers**, **desligue "Allow new users to sign up"**. Assim, só quem você cadastrar consegue entrar.

> Só edita quem **tem usuário** e **está na tabela `editores`**. Os demais visitantes apenas visualizam o relatório.

## 3. Ligar o site ao banco

1. No Supabase, abra **Project Settings → API Keys**. A URL fica em **Data API**.
2. Copie o **Project URL** e a **Publishable key** (`sb_publishable_...`). Em projetos antigos, ela aparece como **anon public**.
3. Cole os dois no `config.js`:

   ```js
   window.SUPABASE_CONFIG = {
     url: "https://xxxxxxxx.supabase.co",
     anonKey: "eyJhbGciOi...",
   };
   ```

   A chave `anon` foi feita para ficar pública. Quem protege os dados são as regras criadas pelo `setup.sql`.
   **Nunca** coloque aqui a chave `service_role`.

## 4. Cadastrar os casos de teste

Abra o site, clique em **Entrar**, faça login e use **+ Novo caso de teste**.
Inclua, edite e exclua os casos pelo próprio site. Tudo é gravado no banco na hora.

## 5. Publicar no GitHub e no Vercel

1. Crie um repositório no GitHub e envie os arquivos:

   ```bash
   git init
   git add .
   git commit -m "Relatório de testes"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/relatorio-de-testes.git
   git push -u origin main
   ```

2. No Vercel, clique em **Add New → Project**, importe o repositório e mantenha **Framework Preset: Other**, sem comando de build.
3. Clique em **Deploy**.

Depois disso, o banco é atualizado na hora pelo site. Só é preciso fazer `git push` quando o **código** ou o **cabeçalho** no `index.html` mudarem. O Vercel publica sozinho a cada push.

---

## Bom saber

- **Pausa do plano gratuito:** o Supabase pausa projetos gratuitos que ficam cerca de **7 dias sem uso**. Os dados não se perdem. Para voltar, abra o projeto no painel do Supabase e clique em **Restore**.
- **Novo editor:** crie o usuário (passo 2) e rode no SQL Editor:
  `insert into public.editores (email) values ('pessoa@empresa.com');`
- **Remover editor:** `delete from public.editores where email = 'pessoa@empresa.com';`
- **Backup:** no Supabase, abra **Table Editor → casos_teste → Export → CSV**.
- **Vercel gratuito (Hobby):** os termos limitam o plano a uso pessoal e não comercial. Para uso pela empresa, confira os termos atuais ou publique na **Cloudflare Pages** (gratuito). O site funciona igual nos dois.
