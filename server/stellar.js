const StellarSdk = require('@stellar/stellar-sdk');
const fs = require('fs');
const path = require('path');

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'PUBLIC'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

const PLATFORM_FILE = path.join(__dirname, '.platform-wallet.json');

let platformKeypair = null;

async function initPlatformWallet() {
  if (process.env.PLATFORM_SECRET) {
    platformKeypair = StellarSdk.Keypair.fromSecret(process.env.PLATFORM_SECRET);
    console.log('Platform wallet from env:', platformKeypair.publicKey());
    return platformKeypair;
  }
  if (fs.existsSync(PLATFORM_FILE)) {
    const saved = JSON.parse(fs.readFileSync(PLATFORM_FILE, 'utf8'));
    platformKeypair = StellarSdk.Keypair.fromSecret(saved.secret);
    console.log('Platform wallet restored:', platformKeypair.publicKey());
    return platformKeypair;
  }
  platformKeypair = StellarSdk.Keypair.random();
  fs.writeFileSync(PLATFORM_FILE, JSON.stringify({ secret: platformKeypair.secret(), publicKey: platformKeypair.publicKey() }));
  console.log('Platform wallet created:', platformKeypair.publicKey());
  try {
    const res = await fetch(`https://friendbot.stellar.org?addr=${platformKeypair.publicKey()}`);
    if (res.ok) console.log('Platform wallet funded on testnet');
    else console.log('Could not fund platform wallet (may already exist):', await res.text());
  } catch (e) {
    console.log('Friendbot unavailable, platform wallet not funded:', e.message);
  }
  return platformKeypair;
}

function getPlatformPublicKey() {
  return platformKeypair ? platformKeypair.publicKey() : null;
}

async function createUserWallet(username) {
  const keypair = StellarSdk.Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

async function fundTestnetWallet(publicKey) {
  if (NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC) {
    throw new Error('Cannot fund wallet on PUBLIC network');
  }
  const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Friendbot error: ${text}`);
  }
  return response.json();
}

async function getWalletBalance(publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances;
  } catch {
    return [];
  }
}

async function makePayment(fromSecret, toPublicKey, amount) {
  const sourceKeypair = StellarSdk.Keypair.fromSecret(fromSecret);
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination: toPublicKey,
      asset: StellarSdk.Asset.native(),
      amount: amount.toString(),
    }))
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

module.exports = {
  initPlatformWallet,
  getPlatformPublicKey,
  createUserWallet,
  fundTestnetWallet,
  getWalletBalance,
  makePayment,
};
