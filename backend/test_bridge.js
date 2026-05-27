const { CoreBridge } = require('./src/lib/core-bridge');

async function test() {
  try {
    console.log('Initializing CoreBridge...');
    const bridge = new CoreBridge();
    console.log('CoreBridge initialized.');
    
    console.log('Fetching stations...');
    const stations = bridge.getStations();
    console.log(`Found ${stations.length} stations.`);
    if (stations.length > 0) {
      console.log('First station:', stations[0]);
    }
    
    bridge.dispose();
    console.log('CoreBridge disposed.');
  } catch (e) {
    console.error('CoreBridge test failed:', e.message);
  }
}

test();
