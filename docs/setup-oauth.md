# Google OAuth setup

Configurar las credenciales para que el login con Google funcione contra el Supabase local.

## 1. Crear OAuth client en Google Cloud

1. Ir a https://console.cloud.google.com/apis/credentials
2. Si no existe un proyecto, crear uno (ej: `prode-mundial-2026`).
3. **APIs & Services** → **OAuth consent screen**:
   - User type: **External**
   - App name: `Prode Mundial 2026`
   - User support email: tu email
   - Scopes: dejar los default (`email`, `profile`, `openid`)
   - Test users: agregar los emails que van a usar la app (mientras el consent screen est&eacute; en `Testing`)
4. **Credentials** → **+ Create credentials** → **OAuth client ID**:
   - Application type: **Web application**
   - Name: `Supabase Local`
   - **Authorized redirect URIs**:
     - `http://127.0.0.1:54321/auth/v1/callback` (Supabase local)
     - Cuando subas a Vercel agreg&aacute;s tambi&eacute;n: `https://<tu-proyecto>.supabase.co/auth/v1/callback`
5. Copiar **Client ID** y **Client secret**.

## 2. Pegar las credenciales en `.env`

Editar el archivo `.env` en el root del repo (ya est&aacute; gitignored):

```bash
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxxxxxxx
```

## 3. Reiniciar Supabase

```bash
npm run db:stop
npm run db:start
```

`supabase/config.toml` ya tiene `[auth.external.google]` apuntando a esas env vars.

## 4. Configurar `.env.local` para Next

Despu&eacute;s del `db:start`, la CLI imprime las URLs y claves. Pegar en `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key del output>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key del output>
API_FOOTBALL_KEY=<tu-key>
```

## 5. Probar

```bash
npm run dev
```

Abrir http://localhost:3000/login y hacer click en "Continuar con Google".

Si tu email no est&aacute; en `allowed_emails`, vas a ver el mensaje "Tu email no est&aacute; autorizado". Para agregar usuarios, por ahora se hace por SQL:

```sql
insert into allowed_emails (email) values ('amigo@gmail.com');
```

(En Fase 2 hay una UI en `/admin/allowed-emails`.)
