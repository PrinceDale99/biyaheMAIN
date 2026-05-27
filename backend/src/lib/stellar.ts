import { 
  Asset, 
  Keypair, 
  Networks, 
  Operation, 
  TransactionBuilder, 
  rpc, 
  nativeToScVal, 
  scValToNative, 
  Address,
  xdr,
  Account
} from '@stellar/stellar-sdk';

/**
 * Stellar Soroban Integration for Biyahe Rewarding System
 * Contract ID: CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT
 */

/**
 * Stellar Soroban Integration for Biyahe Rewarding System
 * Native Asset Contract (XLM) ID on Testnet: CAS3J7GYCCXG3Y3NGAYSHM65O4E5X7OT776QZ2TFYLQUGGU4ZTX5THP3
 */

const NATIVE_ASSET_ID = 'CAS3J7GYCCXG3Y3NGAYSHM65O4E5X7OT776QZ2TFYLQUGGU4ZTX5THP3';
const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID || 'CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT';
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new rpc.Server(RPC_URL);

export class StellarRewards {
  /**
   * Rewards a contributor with native XLM by calling the Soroban contract.
   * The contract then calls the Native Asset Contract to transfer XLM.
   */
  static async rewardContributor(contributorAddress: string, amount: number) {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      throw new Error('STELLAR_ADMIN_SECRET not configured');
    }

    const adminKeypair = Keypair.fromSecret(adminSecret);
    const adminAddress = adminKeypair.publicKey();

    try {
      const source = await server.getAccount(adminAddress);

      // In a real production scenario, the contract would hold XLM
      // and we would call the contract's 'reward_contributor' function.
      // For this implementation, we ensure it's Native XLM (amount is in stroops if i128, or 10^7 scale).
      const tx = new TransactionBuilder(source, {
        fee: '10000',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      .addOperation(
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
              contractAddress: Address.fromString(CONTRACT_ID).toScAddress(),
              functionName: 'reward_contributor',
              args: [
                Address.fromString(adminAddress).toScVal(),
                Address.fromString(contributorAddress).toScVal(),
                nativeToScVal(BigInt(amount * 10000000), { type: 'i128' }), // Convert XLM to Stroops
              ],
            })
          ),
          auth: [],
        })
      )
      .setTimeout(60)
      .build();

      tx.sign(adminKeypair);

      const simulation = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(`Simulation failed: ${simulation.error}`);
      }

      const assembledTxBuilder = rpc.assembleTransaction(tx, simulation);
      const builtTx = assembledTxBuilder.build();
      builtTx.sign(adminKeypair);

      const response = await server.sendTransaction(builtTx);
      
      if (response.status === 'ERROR') {
        throw new Error(`Transaction failed: ${JSON.stringify(response)}`);
      }

      // Wait for ledger inclusion
      let status: string = response.status;
      let txResponse = response;
      while (status === 'PENDING') {
        await new Promise(r => setTimeout(r, 2000));
        const res = await server.getTransaction(response.hash);
        status = res.status as string;
        txResponse = res as any;
      }

      return {
        hash: response.hash,
        status: status,
        amount: amount
      };
    } catch (error: any) {
      console.error('[STELLAR] Reward failed:', error.message || error);
      throw error;
    }
  }

  /**
   * Fetches the native XLM balance of a user using the Native Asset Contract.
   */
  static async getBalance(userAddress: string): Promise<bigint> {
    try {
      const tx = new TransactionBuilder(
        new Account(userAddress, '0'),
        {
          fee: '1000',
          networkPassphrase: NETWORK_PASSPHRASE,
        }
      )
      .addOperation(
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
              contractAddress: Address.fromString(NATIVE_ASSET_ID).toScAddress(),
              functionName: 'balance',
              args: [
                Address.fromString(userAddress).toScVal(),
              ],
            })
          ),
          auth: [],
        })
      )
      .setTimeout(30)
      .build();

      const simulation = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationSuccess(simulation) && simulation.result) {
        return scValToNative(simulation.result.retval);
      }
      return BigInt(0);
    } catch (error) {
      console.error('[STELLAR] Get balance failed:', error);
      return BigInt(0);
    }
  }
}
