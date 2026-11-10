# Ativar o login por e-mail (Supabase)

Com isto, qualquer pessoa sincroniza celular e computador só digitando o e-mail e um código de 6 dígitos, sem precisar de conta no GitHub. É grátis para uso pessoal e para um grupo pequeno.

## 1. Criar o projeto

1. Crie uma conta em <https://supabase.com> (pode entrar com o GitHub) e clique em **New project**.
2. Dê um nome (ex.: `focus`), crie uma senha para o banco (guarde-a) e escolha a região **South America (São Paulo)**.

## 2. Criar a tabela (cole no SQL Editor e clique em Run)

```sql
create table public.focus_sync (
  user_id uuid primary key references auth.users on delete cascade,
  data text not null,
  updated_at timestamptz not null default now()
);

alter table public.focus_sync enable row level security;

-- cada pessoa só lê e grava a própria linha
create policy "dono le"       on public.focus_sync for select using (auth.uid() = user_id);
create policy "dono cria"     on public.focus_sync for insert with check (auth.uid() = user_id);
create policy "dono atualiza" on public.focus_sync for update using (auth.uid() = user_id);
```

## 3. E-mail com código (em vez de link)

Em **Authentication → Email Templates → Magic Link**, troque o corpo por:

```html
<h2>Seu código do Focus</h2>
<p>Digite este código no app: <b style="font-size:22px">{{ .Token }}</b></p>
<p>Ele vale por alguns minutos. Se não foi você, ignore este e-mail.</p>
```

## 4. Envio de e-mails para outras pessoas

O envio que vem pronto no Supabase só manda e-mails para os membros do próprio projeto e tem um limite baixo por hora. Para outras pessoas (sua irmã, amigos) receberem o código, configure um serviço de envio grátis:

1. Crie uma conta em <https://resend.com> (grátis até 3.000 e-mails por mês) e gere uma **API key**.
2. No Supabase, em **Project Settings → Authentication → SMTP Settings**, ative **Custom SMTP** com:
   - Host: `smtp.resend.com` · Porta: `465` · Usuário: `resend` · Senha: a API key
   - Remetente: `onboarding@resend.dev` (ou um endereço do seu domínio, se tiver)

## 5. Ligar no app

Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** e cole em `js/account.js`:

```js
const SUPABASE = { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' };
```

A chave "anon" é feita para ficar no app (é pública); a proteção dos dados vem das regras do passo 2.

Depois, aumente `VERSION` em `sw.js` e publique (`git push`). Em Ajustes → Sincronizar, aparece "Entrar com e-mail"; a opção do GitHub continua disponível em "Outra forma".
