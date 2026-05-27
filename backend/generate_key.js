const { Keypair } = require('@stellar/stellar-sdk');
const fs = require('fs');

const kp = Keypair.random();
const data = {
  publicKey: kp.publicKey(),
  secret: kp.secret()
};

fs.writeFileSync('temp_stellar_key.json', JSON.stringify(data, null, 2));
console.log('Public Key:', kp.publicKey());
