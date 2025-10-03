# Social Media Scheduler - 0Chiacchiere

Una piattaforma professionale per gestire il flusso di contenuti social tra OnlySocial e DigitalOcean Spaces.

## 🎯 Obiettivo del Progetto

Questo sistema gestisce automaticamente il flusso di video tra l'API di OnlySocial e DigitalOcean Spaces per ottimizzare l'uso dei 20GB di storage di OnlySocial, mantenendo solo i video necessari per le prossime 6 ore.

## 🏗️ Architettura

- **Frontend**: Next.js 14 con TypeScript e Tailwind CSS
- **Backend**: API Routes di Next.js
- **Database**: PostgreSQL (NeonDB) con Prisma ORM
- **Autenticazione**: NextAuth.js con hash bcrypt
- **Storage**: DigitalOcean Spaces (illimitato)
- **Social Management**: OnlySocial API (20GB limitati)

## 🚀 Getting Started

### Installazione

```bash
# Installa le dipendenze
npm install

# Configura le variabili di ambiente
cp .env.local.example .env.local

# Avvia il server di sviluppo
npm run dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
