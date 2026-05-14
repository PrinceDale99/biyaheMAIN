#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

// We define our storage keys. 
// Admin is stored in the instance (one per contract).
// Balance is persistent, tied to specific contributor addresses.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
}

#[contract]
pub struct BiyaheRewardsContract;

#[contractimpl]
impl BiyaheRewardsContract {
    /// Initializes the Neural Grid reward contract with the Root Admin.
    /// Can only be called once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// MVP Transaction: Rewards a contributor for plotting valid transit intel.
    /// Only the stored Root Admin can execute this after route verification.
    pub fn reward_contributor(env: Env, admin: Address, contributor: Address, amount: i128) {
        // Require the admin to sign the transaction
        admin.require_auth();

        // Verify the caller is the registered Root Admin
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialized");

        if admin != stored_admin {
            panic!("unauthorized: only admin can reward");
        }

        // Ensure the reward is a valid positive value
        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Fetch current balance or default to 0, add the new reward, and save.
        let key = DataKey::Balance(contributor.clone());
        let mut balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        balance += amount;
        
        env.storage().persistent().set(&key, &balance);
    }

    /// Read-only function for operatives to check their available reward balance.
    pub fn get_balance(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(user)).unwrap_or(0)
    }
}