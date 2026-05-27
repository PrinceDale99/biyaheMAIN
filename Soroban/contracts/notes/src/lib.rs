#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NativeAsset,
}

#[contract]
pub struct BiyaheRewardsContract;

#[contractimpl]
impl BiyaheRewardsContract {
    /// Initializes the contract with an admin and the native asset (XLM) contract address.
    pub fn initialize(env: Env, admin: Address, native_asset: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NativeAsset, &native_asset);
    }

    /// Rewards a contributor by transferring native XLM from the contract's balance.
    /// Only the registered Admin can trigger this (called from the secure backend).
    pub fn reward_contributor(env: Env, admin: Address, contributor: Address, amount: i128) {
        // Ensure the admin has authorized this call
        admin.require_auth();

        // Verify the caller is the registered admin
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialized");

        if admin != stored_admin {
            panic!("unauthorized: only admin can distribute rewards");
        }

        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Get the Native Asset Contract (XLM) client
        let native_asset: Address = env
            .storage()
            .instance()
            .get(&DataKey::NativeAsset)
            .expect("native asset not configured");
        
        let client = token::Client::new(&env, &native_asset);
        
        // Transfer XLM from this contract to the contributor
        client.transfer(&env.current_contract_address(), &contributor, &amount);
    }

    /// Helper to check the XLM balance of a user directly through this contract.
    pub fn get_balance(env: Env, user: Address) -> i128 {
        let native_asset: Address = env
            .storage()
            .instance()
            .get(&DataKey::NativeAsset)
            .expect("native asset not configured");
        
        let client = token::Client::new(&env, &native_asset);
        client.balance(&user)
    }
}
