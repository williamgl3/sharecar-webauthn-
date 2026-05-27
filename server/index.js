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

function createApp() {
  const app = express();

  const allowedOrigin = process.env.ORIGIN || 'http://localhost:5173';
  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json({ limit: '10mb' }));

  const rpName = 'ShareCar';
  const rpID = process.env.RPID || 'localhost';
  const origin = process.env.ORIGIN || 'http://localhost:5173';

  const challengeMap = new Map();

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
    const user = {
      id: base64url.encode(crypto.randomBytes(16)),
      username,
      password: createPassword(password),
      credentials: [],
    };
    await saveUser(user);
    res.send({ ok: true, user: { id: user.id, username: user.username } });
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send({ error: 'username and password required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    if (!verifyPassword(password, user.password)) return res.status(400).send({ error: 'invalid credentials' });
    res.send({ ok: true, user: { id: user.id, username: user.username } });
  });

  app.post('/register/options', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send({ error: 'username required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    const options = generateRegistrationOptions({
      rpName, rpID,
      userID: user.id,
      userName: user.username,
      attestationType: 'direct',
      authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
      supportedAlgorithmIDs: [-7],
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
    try {
      const verification = await verifyRegistrationResponse({
        response: attestation,
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

  app.post('/auth/options', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send({ error: 'username required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    if (!user.credentials || user.credentials.length === 0) {
      return res.status(400).send({ error: 'no passkey registered' });
    }
    const options = generateAuthenticationOptions({
      timeout: 60000,
      allowCredentials: toCredentialList(user),
      userVerification: 'required',
      rpID,
    });
    challengeMap.set(username, options.challenge);
    res.send(options);
  });

  app.post('/auth/verify', async (req, res) => {
    const { username, assertion } = req.body;
    if (!username || !assertion) return res.status(400).send({ error: 'missing data' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    try {
      const authenticator = getAuthenticator(user, assertion.id);
      if (!authenticator) return res.status(400).send({ error: 'credential not found' });
      const verification = await verifyAuthenticationResponse({
        response: assertion,
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

  app.post('/users/photo', async (req, res) => {
    const { username, image } = req.body;
    if (!username || !image) return res.status(400).send({ error: 'username and image required' });
    const user = await getUser(username);
    if (!user) return res.status(400).send({ error: 'user not found' });
    user.faceImage = image;
    await saveUser(user);
    res.send({ ok: true });
  });

  function loadVehicleCatalog() {
    try {
      const catalogPath = path.join(__dirname, 'vehicles-catalog.json');
      if (fs.existsSync(catalogPath)) return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    } catch (error) {
      console.error('Error loading vehicle catalog:', error);
    }
    return [];
  }

  const vehicleCatalog = loadVehicleCatalog();

  app.get('/vehicles', async (_req, res) => {
    const published = await getVehicles();
    res.send({ ok: true, vehicles: published.length > 0 ? published : vehicleCatalog });
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
    const { vehicleId, vehicle, userId, rentalDate } = req.body;
    if (!vehicleId || !userId) return res.status(400).send({ error: 'vehicleId and userId required' });
    const data = await readData();
    data.rentals = Array.isArray(data.rentals) ? data.rentals : [];
    data.rentals.push({
      id: base64url.encode(crypto.randomBytes(12)),
      vehicleId, vehicle, userId,
      rentalDate: rentalDate || new Date().toISOString(),
      status: 'booked',
    });
    await writeData(data);
    res.send({ ok: true });
  });

  app.get('/rentals/:username', async (req, res) => {
    const data = await readData();
    const rentals = Array.isArray(data.rentals) ? data.rentals : [];
    res.send({ ok: true, rentals: rentals.filter((r) => r.userId === req.params.username) });
  });

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`WebAuthn demo server listening on http://localhost:${port}`);
  });
}

module.exports = { createApp };
