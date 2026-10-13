// Aplica un archivo .sql a la base configurada en .env (conexión CI_*).
// Uso: node scripts/aplicar-sql.cjs sql/081_alter_recepcion_mineral_proveedor.sql
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const raiz = path.join(__dirname, '..');
for (const linea of fs.readFileSync(path.join(raiz, '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(linea);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const archivo = process.argv[2];
if (!archivo) {
  console.error('Falta el archivo .sql');
  process.exit(1);
}

(async () => {
  const client = new Client({
    host: process.env.CI_HOST,
    port: +(process.env.CI_PORT || 5432),
    database: process.env.CI_NAME,
    user: process.env.CI_USERNAME,
    password: process.env.CI_PASSWORD,
  });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.resolve(raiz, archivo), 'utf8'));
    console.log(`Aplicado ${archivo} en ${process.env.CI_HOST}:${process.env.CI_PORT}/${process.env.CI_NAME}`);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
