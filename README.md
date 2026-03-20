# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies (npm workspaces: single lockfile at repo root).
npm install

# Step 4: Run the Vite dev server (port 8080) and the Fastify API (port 3333) together.
npm run dev
```

Monorepo layout: `apps/web` (Vite + React) and `apps/api` (Fastify). You can also run each app alone: `npm run dev -w apps/web` and `npm run dev -w apps/api`.

The API needs `DATABASE_URL` (and optionally `JWT_SECRET`, `PORT`, `HOST`) — see `apps/api/.env.example`. For a full TypeScript check of the server: `npm run typecheck -w apps/api` (may report errors until the codebase is aligned with `tsc`).

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Backend (Fastify)

API local padrao: `http://localhost:3333` (pacote `apps/api`).

Variaveis de ambiente sugeridas (no diretorio `apps/api` ou na raiz, conforme `dotenv`):

```sh
DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require
JWT_SECRET=uma-chave-segura
PORT=3333
HOST=0.0.0.0
```

Para apontar o front-end para outro host, defina `VITE_API_URL` (e opcionalmente `VITE_WS_URL`) em `apps/web/.env.local` — veja `apps/web/.env.example`:

```sh
VITE_API_URL=http://localhost:3333
```

Autenticacao atual usa e-mail + senha.

Observacoes:
- CEP do cliente e do prestador sao usados para validar raio (usa BrasilAPI/Nominatim para coordenadas).
- O chat abre apos o prestador aceitar e ambos confirmarem o servico.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
