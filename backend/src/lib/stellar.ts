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
  xdr
} from '@stellar/stellar-sdk';

/**
 * Stellar Soroban Integration for Biyahe Rewarding System
 * Contract ID: CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT
 */

const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID || '';
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new rpc.Server(RPC_URL);

export class StellarRewards {
  /**
   * Rewards a contributor by calling the Soroban contract.
   */
  static async rewardContributor(contributorAddress: string, amount: number) {
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminSecret) {
      throw new Error('STELLAR_ADMIN_SECRET not configured');
    }

    const adminKeypair = Keypair.fromSecret(adminSecret);
    const adminAddress = adminKeypair.publicKey();

    try {
      const account = await server.getLatestLedger(); // Just to check connectivity
      const source = await server.getAccount(adminAddress);

      // Prepare the contract call
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
                nativeToScVal(BigInt(amount), { type: 'i128' }),
              ],
            })
          ),
          auth: [],
        })
      )
      .setTimeout(30)
      .build();

      // Sign the transaction
      tx.sign(adminKeypair);

      // Simulate first (recommended for Soroban)
      const simulation = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(simulation)) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.error)}`);
      }

      // Assemble transaction with simulation results (gas, etc.)
      const assembledTx = rpc.assembleTransaction(tx, simulation);
      assembledTx.sign(adminKeypair);

      // Send transaction
      const response = await server.sendTransaction(assembledTx);
      
      if (response.status === 'ERROR') {
        throw new Error(`Transaction failed: ${JSON.stringify(response)}`);
      }

      return {
        hash: response.hash,
        status: response.status
      };
    } catch (error) {
      console.error('[STELLAR] Reward failed:', error);
      throw error;
    }
  }

  /**
   * Fetches the balance of a user from the contract.
   */
  static async getBalance(userAddress: string): Promise<bigint> {
    try {
      // For read-only calls, we can use simulateTransaction or a dedicated query method if the SDK supports it
      // Using simulateTransaction with a dummy transaction is common for Soroban reads if no specific query tool exists
      // However, Stellar SDK often has better ways now.
      
      const result = await server.getAccount(userAddress); // Just dummy check for now
      // In a real implementation, we'd use a simulate call to 'get_balance'
      return BigInt(0); // Placeholder
    } catch (error) {
      return BigInt(0);
    }
  }
}
