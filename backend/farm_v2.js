const { Keypair, Horizon, TransactionBuilder, Operation, Networks, Asset, xdr, Address } = require('@stellar/stellar-sdk');

const MASTER_SECRET = 'SARBZ7QIFDW2WYETHQTDQVCCETSFJKDWEVA52LJLHMMOCHN3KT2L4NQY';
const MASTER_KP = Keypair.fromSecret(MASTER_SECRET);
const MASTER_ADDRESS = MASTER_KP.publicKey();
const TARGET_CONTRACT = 'CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT';
const NATIVE_SAC_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const server = new Horizon.Server('https://horizon-testnet.stellar.org');

async function farmBatch(count) {
  console.log(`Starting batch of ${count} calls to fund ${MASTER_ADDRESS}...`);
  for (let i = 1; i <= count; i++) {
    try {
      const tempKp = Keypair.random();
      const tempAddr = tempKp.publicKey();
      
      console.log(`[${i}/${count}] Funding temp account ${tempAddr}...`);
      const fundResp = await fetch(`https://friendbot.stellar.org/?addr=${tempAddr}`);
      if (!fundResp.ok) throw new Error(`Friendbot failed: ${fundResp.status}`);
      
      console.log(`[${i}/${count}] Merging into master...`);
      const tempAcc = await server.loadAccount(tempAddr);
      const tx = new TransactionBuilder(tempAcc, {
        fee: '1000',
        networkPassphrase: Networks.TESTNET
      })
      .addOperation(Operation.accountMerge({ destination: MASTER_ADDRESS }))
      .setTimeout(30)
      .build();
      
      tx.sign(tempKp);
      const submitResp = await server.submitTransaction(tx);
      console.log(`[${i}/${count}] Success! Hash: ${submitResp.hash.substring(0, 8)}...`);
      
    } catch (e) {
      console.error(`[${i}/${count}] Error: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000));
      i--; // Retry
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

async function transferToContract() {
  try {
    const account = await server.loadAccount(MASTER_ADDRESS);
    const balance = account.balances.find(b => b.asset_type === 'native').balance;
    console.log(`Current Master Balance: ${balance} XLM`);
    
    // We want to send most of it, e.g. balance - 50 XLM for safety
    const amountToSend = BigInt(Math.floor((parseFloat(balance) - 50) * 10000000)); 
    if (amountToSend <= 0n) {
      console.log('No balance to transfer.');
      return;
    }

    console.log(`Transferring ${Number(amountToSend) / 10000000} XLM to contract ${TARGET_CONTRACT} via SAC...`);
    
    // Construct the SAC transfer call
    // transfer(from: Address, to: Address, amount: i128)
    const tx = new TransactionBuilder(account, {
      fee: '100000', // Higher fee for Soroban
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(NATIVE_SAC_ID).toScAddress(),
          functionName: 'transfer',
          args: [
            Address.fromString(MASTER_ADDRESS).toScVal(),
            Address.fromString(TARGET_CONTRACT).toScVal(),
            xdr.ScVal.scvI128(new xdr.Int128Parts({
              lo: xdr.Uint64.fromString((amountToSend % (2n**64n)).toString()),
              hi: xdr.Int64.fromString((amountToSend / (2n**64n)).toString())
            }))
          ]
        })
      ),
      auth: []
    }))
    .setTimeout(60)
    .build();

    // Note: In production we would need to simulate and get resource fees
    // but on testnet with high fee it might work if the contract is simple.
    // Actually, SAC transfer is standard.

    tx.sign(MASTER_KP);
    const response = await server.submitTransaction(tx);
    console.log(`Transfer successful! Hash: ${response.hash}`);
  } catch (e) {
    console.error('Transfer failed:', e.message);
    if (e.response && e.response.data && e.response.data.extras) {
      console.error('Extras:', JSON.stringify(e.response.data.extras));
    }
  }
}

async function run() {
  // We need ~50 more calls to reach ~670k (already have 180k)
  await farmBatch(50);
  await transferToContract();
}

run();
