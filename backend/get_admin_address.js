const { Keypair } = require('@stellar/stellar-sdk');
require('dotenv').config({ path: '.env.local' });
let adminSecret = process.env.STELLAR_ADMIN_SECRET;

if (!adminSecret) {
  require('dotenv').config({ path: '.env' });
  adminSecret = process.env.STELLAR_ADMIN_SECRET;
}

if (!adminSecret) {
  console.error('STELLAR_ADMIN_SECRET not found in .env or .env.local');
  process.exit(1);
}

try {
  const adminKeypair = Keypair.fromSecret(adminSecret);
  console.log(adminKeypair.publicKey());
} catch (e) {
  console.error('Error deriving public key:', e.message);
  process.exit(1);
}
