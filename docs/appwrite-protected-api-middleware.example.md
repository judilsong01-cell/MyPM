# Example: Protected API Middleware (Node/Express + Appwrite)

Objetivo:
- exigir sessao valida em todas as requests
- exigir utilizador verificado (email OU telefone)
- adicionar rate limiting + validacao de inputs (exemplo)

Dependencias:

```bash
npm i express express-rate-limit node-appwrite
```

Exemplo:

```ts
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Account, Client } from 'node-appwrite';

type AuthedRequest = Request & { appwriteUser?: any };

export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const makeClient = (jwt: string) => {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const project = process.env.APPWRITE_PROJECT_ID;
  if (!endpoint || !project) throw new Error('Missing APPWRITE_ENDPOINT/APPWRITE_PROJECT_ID');
  return new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt);
};

export const requireVerifiedAppwriteUser = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = String(req.headers.authorization ?? '');
    const jwt = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!jwt) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

    const client = makeClient(jwt);
    const account = new Account(client);
    const user = await account.get();

    const verified = !!user?.emailVerification || !!user?.phoneVerification;
    if (!verified) return res.status(403).json({ error: 'User not verified' });

    req.appwriteUser = user;
    next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Invalid session', details: String(error?.message ?? error) });
  }
};
```

Nota (cliente mobile):
- Nao persistir tokens em `AsyncStorage`
- Usar sessoes do Appwrite e gerar JWT on-demand por request:

```ts
const jwt = await account.createJWT();
await fetch('/api/protected', {
  headers: { Authorization: `Bearer ${jwt.jwt}` },
});
```

