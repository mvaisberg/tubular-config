---
description: Deploying the application manually to Vercel
---
Because automatic deployment via git push might sometimes fail or be disabled, we need to manually trigger the deployment to Vercel from the local repository.

1. The project must be deployed from the `webapp` folder.
2. Run the command below to build and deploy to Vercel's production environment automatically.

// turbo
3. Run `npx vercel --prod --yes`
