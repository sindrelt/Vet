import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const dbPassword = randomBytes(30).toString('hex');
const adminPassword = randomBytes(32).toString('base64url');
try {
  await writeFile(
    '.env.local',
    `# Local development only. Never commit this file.\nPOSTGRES_PASSWORD=${dbPassword}\nDATABASE_URL=postgresql://vet:${dbPassword}@127.0.0.1:5432/vet\nADMIN_USER=admin\nADMIN_PASSWORD=${adminPassword}\nAPP_ORIGIN=http://localhost:3000\nCOLLECTOR_CONTACT=\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Opprettet .env.local med tilfeldige lokale passord. Åpne filen lokalt for administratorpassordet. Ikke del filen.',
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code === 'EEXIST')
    console.log(
      '.env.local finnes allerede og er bevart. Kontroller innholdet før videre oppsett.',
    );
  else throw e;
}
