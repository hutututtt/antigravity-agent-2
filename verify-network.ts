import { NetworkService } from './src/services/network-service';

async function testNetworkService() {
    console.log('Testing NetworkService...');

    try {
        console.log('Detecting TUN...');
        const tun = await NetworkService.detectTUN();
        console.log('TUN Result:', tun);

        console.log('Getting IP Info...');
        const ipInfo = await NetworkService.getIPInfo();
        console.log('IP Info:', ipInfo);

        console.log('Assessing Risk...');
        const risk = NetworkService.assessRisk(ipInfo);
        console.log('Risk Assessment:', risk);

        console.log('Getting IP Type...');
        const type = NetworkService.getIPType(ipInfo, risk);
        console.log('IP Type:', type);

        console.log('Full Network Status...');
        const status = await NetworkService.getNetworkStatus();
        console.log('Network Status:', JSON.stringify(status, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Mock browser APIs if running in Node.js environment
if (typeof window === 'undefined') {
    global.RTCPeerConnection = class {
        createDataChannel() { }
        createOffer() { return Promise.resolve({}); }
        setLocalDescription() { return Promise.resolve(); }
        close() { }
    } as any;

    global.fetch = require('node-fetch');
    global.AbortController = require('abort-controller');
}

testNetworkService();
