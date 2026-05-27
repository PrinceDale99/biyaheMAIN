const ADDRESS = 'CDZ6PRJM2E6RCGJB5ETJLK3Q2YRPXBSJQGCSWMHJE5PEGGG4SAJXMNOT';
const TOTAL_TARGET = 670000;
const AMOUNT_PER_CALL = 10000; // Friendbot typically gives 10k XLM
const TOTAL_CALLS = Math.ceil(TOTAL_TARGET / AMOUNT_PER_CALL);

async function farm() {
  console.log(`Starting direct farm for contract ${ADDRESS}...`);
  console.log(`Target: ${TOTAL_TARGET} XLM (~${TOTAL_CALLS} calls)`);
  
  for (let i = 1; i <= TOTAL_CALLS; i++) {
    try {
      console.log(`[${i}/${TOTAL_CALLS}] Funding ${ADDRESS}...`);
      const response = await fetch(`https://friendbot.stellar.org/?addr=${ADDRESS}`);
      
      if (response.ok) {
        console.log(`[${i}/${TOTAL_CALLS}] Success! Funded ${AMOUNT_PER_CALL} XLM.`);
      } else {
        const err = await response.text();
        console.error(`[${i}/${TOTAL_CALLS}] Failed: ${response.status} - ${err}`);
        
        if (response.status === 429) {
          console.log('Rate limited. Waiting 30 seconds...');
          await new Promise(r => setTimeout(r, 30000));
          i--; // Retry
        } else {
          // Other error, maybe wait a bit
          await new Promise(r => setTimeout(r, 5000));
          i--;
        }
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000));
      i--;
    }
    // Small delay between calls
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Farming complete.');
}

farm();
