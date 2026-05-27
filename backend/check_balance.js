const { Horizon } = require('@stellar/stellar-sdk');

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const ADDRESS = 'GDS7ZAEEZ5MGZPHUCJBKI4S7MQCBSXM2DNKMJLQRUNNHGZGAX5Y4NYLR';

async function check() {
  try {
    const account = await server.loadAccount(ADDRESS);
    const balance = account.balances.find(b => b.asset_type === 'native').balance;
    console.log(`Balance: ${balance} XLM`);
  } catch (e) {
    console.error('Account not found or error:', e.message);
  }
}

check();
