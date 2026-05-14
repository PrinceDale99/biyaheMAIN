#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

// Test 1 (Happy path): The MVP transaction executes successfully end-to-end
#[test]
fn test_reward_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BiyaheRewardsContract);
    let client = BiyaheRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let contributor = Address::generate(&env);

    client.initialize(&admin);
    // Admin rewards contributor with 100 units for verified intel
    client.reward_contributor(&admin, &contributor, &100);

    assert_eq!(client.get_balance(&contributor), 100);
}

// Test 2 (Edge case): Unauthorized caller attempts to manipulate rewards
#[test]
#[should_panic(expected = "unauthorized: only admin can reward")]
fn test_unauthorized_reward() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BiyaheRewardsContract);
    let client = BiyaheRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let rogue_actor = Address::generate(&env);
    let contributor = Address::generate(&env);

    client.initialize(&admin);
    
    // Rogue actor tries to call reward, triggering a panic
    client.reward_contributor(&rogue_actor, &contributor, &500);
}

// Test 3 (State verification): Assert contract storage reflects correct state over time
#[test]
fn test_state_verification_multiple_rewards() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BiyaheRewardsContract);
    let client = BiyaheRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let contributor = Address::generate(&env);

    client.initialize(&admin);
    
    // State 1: Initial balance must be 0
    assert_eq!(client.get_balance(&contributor), 0);

    // State 2: First valid route submission
    client.reward_contributor(&admin, &contributor, &150);
    assert_eq!(client.get_balance(&contributor), 150);

    // State 3: Second valid route submission, balances must sum correctly
    client.reward_contributor(&admin, &contributor, &250);
    assert_eq!(client.get_balance(&contributor), 400); 
}

// Test 4 (Edge case): Disallow negative or zero reward distributions
#[test]
#[should_panic(expected = "amount must be positive")]
fn test_invalid_reward_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, BiyaheRewardsContract);
    let client = BiyaheRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let contributor = Address::generate(&env);

    client.initialize(&admin);
    
    // System attempts to reward 0, should panic
    client.reward_contributor(&admin, &contributor, &0);
}

// Test 5 (Edge case): Prevent hijacking via double initialization
#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialization() {
    let env = Env::default();
    let contract_id = env.register_contract(None, BiyaheRewardsContract);
    let client = BiyaheRewardsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    
    client.initialize(&admin);
    // Attacker tries to re-initialize to steal admin rights
    client.initialize(&admin); 
}