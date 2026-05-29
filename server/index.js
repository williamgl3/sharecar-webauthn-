const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const base64url = require('base64url');
const { readData, writeData } = require('./data-store.js');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const {
  initPlatformWallet,
  getPlatformPublicKey,
  createUserWallet,
  fundTestnetWallet,
  getWalletBalance,
  makePayment,
  waitForAccount,
} = require('./stellar.js');

function createApp() {
  const app = express();
  initPlatformWallet().catch(() => {});

  const allowedOrigin = process.env.ORIGIN || 'http://localhost:5173';
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api/')) {
      req.url = req.originalUrl = req.url.replace('/api', '');
    }
    next();
  });
  app.use(cors({ origin: (origin, cb) => cb(null, true) }));
  app.use(express.json({ limit: '10mb' }));

  const rpName = 'ShareCar';
  const challengeMap = new Map();

  function getOrigin(req) {
    return req.headers.origin || req.headers.host || allowedOrigin;
  }

  function getRPID(req) {
    try {
      const o = getOrigin(req);
      if (o.startsWith('http')) return new URL(o).hostname;
      return o.split(':')[0];
    } catch { return 'localhost'; }
  }

  async function saveUser(updatedUser) {
    const data = await readData();
    const index = data.users.findIndex((user) => user.username === updatedUser.username);
    if (index >= 0) {
      data.users[index] = updatedUser;
    } else {
      data.users.push(updatedUser);
    }
    await writeData(data);
  }

  async function getVehicles() {
    const data = await readData();
    return Array.isArray(data.vehicles) ? data.vehicles : [];
  }

  async function saveVehicle(vehicle) {
    const data = await readData();
    data.vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    data.vehicles.push(vehicle);
    await writeData(data);
  }

  async function getUser(username) {
    const data = await readData();
    return data.users.find((user) => user.username === username) || null;
  }

  function ensureBalance(user) {
    if (typeof user.simulatedBalance !== 'number') user.simulatedBalance = 10000;
    return user;
  }

  function createPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
  }

  function verifyPassword(password, storedPassword) {
    if (!storedPassword?.salt || !storedPassword?.hash) return false;
    const hash = crypto.scryptSync(password, storedPassword.salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedPassword.hash, 'hex'));
  }

  function toCredentialList(user) {
    return (user.credentials || []).map((c) => ({ id: c.id, type: 'public-key' }));
  }

  function getAuthenticator(user, credentialID) {
    const credential = (user.credentials || []).find((c) => c.id === credentialID);
    if (!credential) return null;
    return {
      credentialID: base64url.toBuffer(credential.id),
      credentialPublicKey: base64url.toBuffer(credential.publicKey),
      counter: credential.counter,
    };
  }

  const distPath = path.join(__dirname, '..', 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  app.get('/', (_req, res) => res.send({ ok: true }));

  app.post('/users', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send({ error: 'username and password required' });
    const existing = await getUser(username);
    if (existing) return res.status(400).send({ error: 'user exists' });
    const wallet = await createUserWallet(username);
    const user = {
      id: base64url.encode(crypto.randomBytes(16)),
      username,
      password: createPassword(password),
      credentials: [],
      stellarPublicKey: wallet.publicKey,
      stellarSecretKey: wallet.secretKey,
      simulatedBalance: 10000,
    };
    await saveUser(user);
    res.send({
      ok: true,
      user: { id: user.id, username: user.username, stellarPublicKey: wallet.publicKey },
    });
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send({ error: 'username and password required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    if (!verifyPassword(password, user.password)) return res.status(400).send({ error: 'invalid credentials' });
    res.send({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        stellarPublicKey: user.stellarPublicKey || null,
      },
    });
  });

  app.post('/register/options', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send({ error: 'username required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    const rpID = getRPID(req);
    const options = generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.username,
      userDisplayName: user.username,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257],
      timeout: 60000,
      excludeCredentials: toCredentialList(user),
    });
    challengeMap.set(username, options.challenge);
    res.send(options);
  });

  app.post('/register/verify', async (req, res) => {
    const { username, attestation } = req.body;
    if (!username || !attestation) return res.status(400).send({ error: 'missing data' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    const origin = getOrigin(req);
    const rpID = getRPID(req);
    try {
      const verification = await verifyRegistrationResponse({
        credential: attestation,
        expectedChallenge: challengeMap.get(username),
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (verification.verified && verification.registrationInfo) {
        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
        user.credentials = user.credentials || [];
        user.credentials.push({
          id: base64url.encode(Buffer.from(credentialID)),
          publicKey: base64url.encode(Buffer.from(credentialPublicKey)),
          counter,
        });
        await saveUser(user);
      }
      res.send({ ok: verification.verified });
    } catch (error) {
      console.error(error);
      res.status(400).send({ error: error.message });
    }
  });

  app.get('/users/:username/credentials', async (req, res) => {
    const user = await getUser(req.params.username);
    if (!user) return res.json({ exists: false, hasCredentials: false });
    res.json({
      exists: true,
      hasCredentials: Array.isArray(user.credentials) && user.credentials.length > 0,
    });
  });

  app.post('/auth/options', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).send({ error: 'username required' });
      }
      const user = await getUser(username);
      if (!user) {
        return res.status(400).send({ error: 'user not found - debe crear usuario primero' });
      }
      if (!user.credentials || user.credentials.length === 0) {
        return res.status(400).send({ error: 'no passkey registered - debe registrar biometría primero' });
      }
      const rpID = getRPID(req);
      const options = generateAuthenticationOptions({
        timeout: 60000,
        allowCredentials: toCredentialList(user),
        userVerification: 'preferred',
        rpID,
      });
      challengeMap.set(username, options.challenge);
      res.send(options);
    } catch (error) {
      console.error('Error in /auth/options:', error);
      res.status(500).send({ error: error.message });
    }
  });

  app.post('/auth/verify', async (req, res) => {
    const { username, assertion } = req.body;
    if (!username || !assertion) return res.status(400).send({ error: 'missing data' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    const origin = getOrigin(req);
    const rpID = getRPID(req);
    try {
      const authenticator = getAuthenticator(user, assertion.id);
      if (!authenticator) return res.status(400).send({ error: 'credential not found' });
      const verification = await verifyAuthenticationResponse({
        credential: assertion,
        expectedChallenge: challengeMap.get(username),
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator,
      });
      if (verification.verified && verification.authenticationInfo) {
        const idx = (user.credentials || []).findIndex((c) => c.id === assertion.id);
        if (idx >= 0) {
          user.credentials[idx].counter = verification.authenticationInfo.newCounter;
          await saveUser(user);
        }
      }
      res.send({ ok: verification.verified });
    } catch (error) {
      console.error(error);
      res.status(400).send({ error: error.message });
    }
  });

  app.get('/wallet/:username', async (req, res) => {
    try {
      let user = await getUser(req.params.username);
      if (!user) {
        const wallet = await createUserWallet(req.params.username);
        user = {
          id: base64url.encode(crypto.randomBytes(16)),
          username: req.params.username,
          password: createPassword(Math.random().toString(36)),
          credentials: [],
          stellarPublicKey: wallet.publicKey,
          stellarSecretKey: wallet.secretKey,
          simulatedBalance: 10000,
        };
        await saveUser(user);
      }
      ensureBalance(user);
      const xlmBalance = user.simulatedBalance.toFixed(7);
      const balances = [{ asset_type: 'native', balance: xlmBalance }];
      res.send({ ok: true, publicKey: user.stellarPublicKey || null, balances, platformPublicKey: getPlatformPublicKey() });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/wallet/fund', async (req, res) => {
    const { username } = req.body;
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'wallet not found' });
    ensureBalance(user);
    user.simulatedBalance += 10000;
    await saveUser(user);
    res.send({ ok: true, balance: user.simulatedBalance });
  });

  app.post('/wallet/pay', async (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount) return res.status(400).send({ error: 'username and amount required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    ensureBalance(user);
    if (user.simulatedBalance < amount) return res.status(400).send({ error: 'Saldo insuficiente' });
    user.simulatedBalance -= amount;
    await saveUser(user);
    res.send({ ok: true, amount, remainingBalance: user.simulatedBalance });
  });

  app.post('/users/photo', async (req, res) => {
    const { username, image } = req.body;
    if (!username || !image) return res.status(400).send({ error: 'username and image required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    user.faceImage = image;
    await saveUser(user);
    res.send({ ok: true });
  });

  let vehicleCatalog = [];
  try {
    vehicleCatalog = require('./vehicles-catalog.json');
  } catch (error) {
    console.error('Error loading vehicle catalog:', error.message);
  }

  app.get('/vehicles', async (_req, res) => {
    const published = await getVehicles();
    let vehicles = [...vehicleCatalog];
    if (published.length > 0) {
      const mapped = published.map(v => ({
        id: v.id,
        brand: v.make || 'Marca no especificada',
        model: v.model || 'Modelo no especificado',
        year: new Date().getFullYear(),
        pricePerHour: v.pricePerHour || 0,
        description: `Vehículo publicado por ${v.owner || 'usuario desconocido'}`,
        features: [],
        image: 'https://picsum.photos/seed/car-default/400/300',
        rating: 0,
        reviews: 0,
        location: 'No especificada',
        available: true,
        seats: 4,
        transmission: 'Automático',
        fuelType: 'Eléctrico',
        range: 'N/A',
      }));
      vehicles = [...vehicles, ...mapped];
    }
    res.send({ ok: true, vehicles });
  });

  app.get('/vehicles-catalog', (_req, res) => {
    res.send({ ok: true, vehicles: vehicleCatalog });
  });

  app.post('/vehicles', async (req, res) => {
    const { owner, make, model, pricePerHour, currency } = req.body;
    if (!owner || !make || !model) return res.status(400).send({ error: 'owner, make and model required' });
    await saveVehicle({
      id: base64url.encode(crypto.randomBytes(12)),
      owner, make, model,
      pricePerHour: pricePerHour || 0,
      currency: currency || 'XLM',
      createdAt: new Date().toISOString(),
    });
    res.send({ ok: true });
  });

  app.post('/rentals', async (req, res) => {
    try {
      const { vehicleId, vehicle, userId, rentalDate } = req.body;
      if (!vehicleId || !userId) return res.status(400).send({ error: 'vehicleId and userId required' });
      const price = (vehicle && vehicle.pricePerHour) || 0;
      let user = await getUser(userId);
      if (!user) {
        const wallet = await createUserWallet(userId);
        user = {
          id: base64url.encode(crypto.randomBytes(16)),
          username: userId,
          password: createPassword(Math.random().toString(36)),
          credentials: [],
          stellarPublicKey: wallet.publicKey,
          stellarSecretKey: wallet.secretKey,
          simulatedBalance: 10000,
        };
        await saveUser(user);
      }
      ensureBalance(user);
      let deducted = 0;
      if (price > 0 && user.simulatedBalance >= price) {
        user.simulatedBalance -= price;
        deducted = price;
        await saveUser(user);
      }
      const data = await readData();
      data.rentals = Array.isArray(data.rentals) ? data.rentals : [];
      data.rentals.push({
        id: base64url.encode(crypto.randomBytes(12)),
        vehicleId, vehicle, userId,
        rentalDate: rentalDate || new Date().toISOString(),
        status: 'booked',
        paymentAmount: deducted,
        paymentCurrency: 'XLM',
        paymentProcessed: deducted > 0,
      });
      await writeData(data);
      res.send({ ok: true, paymentProcessed: deducted > 0, paymentAmount: deducted, paymentCurrency: 'XLM', remainingBalance: user.simulatedBalance });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.get('/rentals/:username', async (req, res) => {
    try {
      const data = await readData();
      const rentals = Array.isArray(data.rentals) ? data.rentals : [];
      res.send({ ok: true, rentals: rentals.filter((r) => r.userId === req.params.username) });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/rentals/:id/cancel', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).send({ error: 'username required' });
      const data = await readData();
      data.rentals = Array.isArray(data.rentals) ? data.rentals : [];
      const rental = data.rentals.find((item) => item.id === req.params.id);
      if (!rental) return res.status(404).send({ error: 'reservation not found' });
      if (rental.userId !== username) return res.status(403).send({ error: 'not authorized' });
      if (rental.status === 'canceled') return res.status(400).send({ error: 'reservation already canceled' });
      rental.status = 'canceled';
      rental.canceledAt = new Date().toISOString();
      if (rental.paymentAmount > 0) {
        const user = await getUser(username);
        if (user) {
          ensureBalance(user);
          user.simulatedBalance += rental.paymentAmount;
          await saveUser(user);
        }
      }
      await writeData(data);
      res.send({ ok: true, rental, refunded: rental.paymentAmount || 0 });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (require.main === module) {
  (async () => {
    await initPlatformWallet();
    const app = createApp();
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`WebAuthn demo server listening on http://localhost:${port}`);
    });
  })();
}

module.exports = { createApp };
