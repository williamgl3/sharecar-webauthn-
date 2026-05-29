import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import base64url from 'base64url';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getStore } from '@netlify/blobs';
import { Keypair, Horizon, Operation, TransactionBuilder, Networks, Asset, BASE_FEE } from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET;
const stellarServer = new Horizon.Server(HORIZON_URL);

function createApp() {
  const app = express();
  app.use(cors({ origin: (origin, cb) => cb(null, true) }));
  app.use(express.json({ limit: '10mb' }));

  const rpName = 'ShareCar';
  const challengeMap = new Map();

  function getOrigin(req) {
    return req.headers.origin || req.headers.host || '';
  }

  function getRPID(req) {
    try {
      const o = getOrigin(req);
      if (o.startsWith('http')) return new URL(o).hostname;
      return o.split(':')[0];
    } catch { return 'localhost'; }
  }

  async function getStoreData() {
    try {
      const store = getStore('webauthn-data');
      const raw = await store.get('data');
      return raw ? JSON.parse(raw) : { users: [], vehicles: [], rentals: [] };
    } catch { return { users: [], vehicles: [], rentals: [] }; }
  }

  async function saveStoreData(data) {
    try {
      const store = getStore('webauthn-data');
      await store.set('data', JSON.stringify(data));
    } catch (e) { console.error('Save error:', e); }
  }

  async function getUser(username) {
    const data = await getStoreData();
    return data.users.find((u) => u.username === username) || null;
  }

  async function saveUser(user) {
    const data = await getStoreData();
    const idx = data.users.findIndex((u) => u.username === user.username);
    if (idx >= 0) data.users[idx] = user;
    else data.users.push(user);
    await saveStoreData(data);
  }

  function createPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
  }

  function verifyPassword(password, stored) {
    if (!stored?.salt || !stored?.hash) return false;
    const hash = crypto.scryptSync(password, stored.salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(stored.hash, 'hex'));
  }

  function toCredentialList(user) {
    return (user.credentials || []).map((c) => ({ id: c.id, type: 'public-key' }));
  }

  function getAuthenticator(user, credentialID) {
    const cred = (user.credentials || []).find((c) => c.id === credentialID);
    if (!cred) return null;
    return {
      credentialID: base64url.toBuffer(cred.id),
      credentialPublicKey: base64url.toBuffer(cred.publicKey),
      counter: cred.counter,
    };
  }

  app.get('/', (_req, res) => res.send({ ok: true, name: 'ShareCar API', version: '1.0.0' }));

  app.post('/users', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).send({ error: 'username and password required' });
      const existing = await getUser(username);
      if (existing) return res.status(400).send({ error: 'user exists' });
      const kp = Keypair.random();
      const user = {
        id: base64url.encode(crypto.randomBytes(16)),
        username,
        password: createPassword(password),
        credentials: [],
        stellarPublicKey: kp.publicKey(),
        stellarSecretKey: kp.secret(),
      };
      await saveUser(user);
      try {
        const fb = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
        if (!fb.ok) console.log('Friendbot unavailable');
      } catch (e) { console.log('Friendbot error:', e.message); }
      res.send({ ok: true, user: { id: user.id, username: user.username, stellarPublicKey: kp.publicKey() } });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).send({ error: 'username and password required' });
      const user = await getUser(username);
      if (!user) return res.status(400).send({ error: 'user not found' });
      if (!verifyPassword(password, user.password)) return res.status(400).send({ error: 'invalid credentials' });
      res.send({ ok: true, user: { id: user.id, username: user.username, stellarPublicKey: user.stellarPublicKey || null } });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/register/options', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).send({ error: 'username required' });
      const user = await getUser(username);
      if (!user) return res.status(400).send({ error: 'user not found' });
      const rpID = getRPID(req);
      const options = generateRegistrationOptions({
        rpName, rpID,
        userID: user.id, userName: user.username, userDisplayName: user.username,
        attestationType: 'none',
        authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
        supportedAlgorithmIDs: [-7, -257],
        timeout: 60000,
        excludeCredentials: toCredentialList(user),
      });
      challengeMap.set(username, options.challenge);
      res.send(options);
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/register/verify', async (req, res) => {
    try {
      const { username, attestation } = req.body;
      if (!username || !attestation) return res.status(400).send({ error: 'missing data' });
      const user = await getUser(username);
      if (!user) return res.status(400).send({ error: 'user not found' });
      const verification = await verifyRegistrationResponse({
        credential: attestation,
        expectedChallenge: challengeMap.get(username),
        expectedOrigin: getOrigin(req),
        expectedRPID: getRPID(req),
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
    } catch (e) { res.status(400).send({ error: e.message }); }
  });

  app.get('/users/:username/credentials', async (req, res) => {
    try {
      const user = await getUser(req.params.username);
      if (!user) return res.json({ exists: false, hasCredentials: false });
      res.json({ exists: true, hasCredentials: Array.isArray(user.credentials) && user.credentials.length > 0 });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/auth/options', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).send({ error: 'username required' });
      const user = await getUser(username);
      if (!user) return res.status(400).send({ error: 'user not found' });
      if (!user.credentials?.length) return res.status(400).send({ error: 'no passkey registered' });
      const options = generateAuthenticationOptions({
        timeout: 60000,
        allowCredentials: toCredentialList(user),
        userVerification: 'preferred',
        rpID: getRPID(req),
      });
      challengeMap.set(username, options.challenge);
      res.send(options);
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/auth/verify', async (req, res) => {
    try {
      const { username, assertion } = req.body;
      if (!username || !assertion) return res.status(400).send({ error: 'missing data' });
      const user = await getUser(username);
      if (!user) return res.status(400).send({ error: 'user not found' });
      const authenticator = getAuthenticator(user, assertion.id);
      if (!authenticator) return res.status(400).send({ error: 'credential not found' });
      const verification = await verifyAuthenticationResponse({
        credential: assertion,
        expectedChallenge: challengeMap.get(username),
        expectedOrigin: getOrigin(req),
        expectedRPID: getRPID(req),
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
    } catch (e) { res.status(400).send({ error: e.message }); }
  });

  app.get('/wallet/:username', async (req, res) => {
    try {
      const user = await getUser(req.params.username);
      if (!user?.stellarPublicKey) return res.status(400).send({ error: 'wallet not found' });
      let balances = [{ asset_type: 'native', balance: '0' }];
      try {
        const account = await stellarServer.loadAccount(user.stellarPublicKey);
        balances = account.balances;
      } catch {
        // Account not yet on network — return 0 balance
      }
      res.send({ ok: true, publicKey: user.stellarPublicKey, balances });
    } catch (e) { res.status(400).send({ error: e.message }); }
  });

  app.post('/wallet/fund', async (req, res) => {
    try {
      const { username } = req.body;
      const user = await getUser(username);
      if (!user?.stellarPublicKey) return res.status(400).send({ error: 'wallet not found' });
      const fb = await fetch(`https://friendbot.stellar.org?addr=${user.stellarPublicKey}`);
      if (!fb.ok) throw new Error('Friendbot error');
      res.send({ ok: true });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/wallet/pay', async (req, res) => {
    try {
      const { username, amount } = req.body;
      if (!username || !amount) return res.status(400).send({ error: 'username and amount required' });
      const user = await getUser(username);
      if (!user?.stellarSecretKey) return res.status(400).send({ error: 'wallet not configured' });
      const kp = Keypair.fromSecret(user.stellarSecretKey);
      const account = await stellarServer.loadAccount(kp.publicKey());
      const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.payment({ destination: process.env.PLATFORM_PUBLIC_KEY || kp.publicKey(), asset: Asset.native(), amount: amount.toString() }))
        .setTimeout(30).build();
      tx.sign(kp);
      const result = await stellarServer.submitTransaction(tx);
      res.send({ ok: true, hash: result.hash, amount });
    } catch (e) { res.status(400).send({ error: e.message }); }
  });

  app.post('/users/photo', async (req, res) => {
    try {
      const { username, image } = req.body;
      if (!username || !image) return res.status(400).send({ error: 'username and image required' });
      const user = await getUser(username);
      if (!user) return res.status(400).send({ error: 'user not found' });
      user.faceImage = image;
      await saveUser(user);
      res.send({ ok: true });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  const vehicleCatalog = [
    { id: 'v001', brand: 'Tesla', model: 'Model 3 Performance', year: 2024, pricePerHour: 25, description: 'Eléctrico de alto rendimiento con aceleración de 0-100 km/h en 3.1 segundos', features: ['Autopilot', 'Carga rápida', 'Pantalla táctil 15 pulgadas', 'WiFi'], image: 'https://picsum.photos/seed/tesla1/400/300', rating: 4.8, reviews: 127, location: 'Centro - Avenida Principal', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '500 km' },
    { id: 'v002', brand: 'Tesla', model: 'Model Y Long Range', year: 2024, pricePerHour: 35, description: 'SUV eléctrico con capacidad de 7 pasajeros y alcance de 500 km', features: ['7 asientos', 'Panoramic roof', 'Carga superrápida'], image: 'https://picsum.photos/seed/tesla2/400/300', rating: 4.9, reviews: 245, location: 'Centro Comercial North', available: true, seats: 7, transmission: 'Automático', fuelType: 'Eléctrico', range: '500 km' },
    { id: 'v003', brand: 'BMW', model: 'i4 eDrive40', year: 2024, pricePerHour: 28, description: 'Sedan deportivo eléctrico con diseño premium alemán', features: ['M Sport', 'Carga rápida', 'Pantalla OLED', 'Sonido Harman Kardon'], image: 'https://picsum.photos/seed/bmw/400/300', rating: 4.7, reviews: 89, location: 'Zona Oeste', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '530 km' },
    { id: 'v004', brand: 'Mercedes-Benz', model: 'EQE', year: 2024, pricePerHour: 32, description: 'Sedán de lujo eléctrico con tecnología de seguridad avanzada', features: ['Cuero Nappa', 'Sunroof', 'Asientos calefaccionables', 'Carga inalámbrica'], image: 'https://picsum.photos/seed/mercedes/400/300', rating: 4.9, reviews: 156, location: 'Zona Exclusiva - Marina', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '450 km' },
    { id: 'v005', brand: 'Audi', model: 'e-tron GT', year: 2024, pricePerHour: 40, description: 'Superdeportivo eléctrico ultra-lujoso', features: ['Carga 80% en 20 min', 'Asientos deportivos', 'Sonido Bang & Olufsen'], image: 'https://picsum.photos/seed/audi/400/300', rating: 5.0, reviews: 78, location: 'Zona Premium - Aeropuerto', available: true, seats: 4, transmission: 'Automático', fuelType: 'Eléctrico', range: '480 km' },
    { id: 'v006', brand: 'Volkswagen', model: 'ID. Buzz', year: 2024, pricePerHour: 30, description: 'Van eléctrica retro con amplio espacio interior', features: ['6-7 asientos', 'Espacio para equipaje', 'WiFi hotspot'], image: 'https://picsum.photos/seed/vw/400/300', rating: 4.6, reviews: 201, location: 'Centro - Terminal', available: true, seats: 7, transmission: 'Automático', fuelType: 'Eléctrico', range: '400 km' },
    { id: 'v007', brand: 'Porsche', model: 'Taycan Turbo GT', year: 2024, pricePerHour: 50, description: 'Supercar eléctrico 0-100 en 2.2s', features: ['Motor dual', 'Carga ultra-rápida', 'Tracción integral'], image: 'https://picsum.photos/seed/porsche/400/300', rating: 4.9, reviews: 34, location: 'Zona VIP', available: true, seats: 4, transmission: 'Automático', fuelType: 'Eléctrico', range: '520 km' },
    { id: 'v008', brand: 'Chevrolet', model: 'Bolt EV', year: 2023, pricePerHour: 18, description: 'Vehículo eléctrico económico y confiable', features: ['Carga rápida', 'Apple CarPlay', 'Maletero amplio'], image: 'https://picsum.photos/seed/chevrolet/400/300', rating: 4.5, reviews: 342, location: 'Centro Comercial Sur', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '417 km' },
    { id: 'v009', brand: 'Hyundai', model: 'Ioniq 5', year: 2024, pricePerHour: 22, description: 'Crossover eléctrico con carga ultra-rápida', features: ['Carga 80% en 18 min', 'Batería 77 kWh', 'Pantalla dual'], image: 'https://picsum.photos/seed/hyundai/400/300', rating: 4.7, reviews: 467, location: 'Zona Este', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '507 km' },
    { id: 'v010', brand: 'Kia', model: 'EV6', year: 2024, pricePerHour: 24, description: 'SUV deportivo eléctrico de última generación', features: ['0-100 km/h en 5.2s', 'Carga 80% en 18 min', 'Modo Track'], image: 'https://picsum.photos/seed/kia/400/300', rating: 4.8, reviews: 523, location: 'Centro - Avenida Principal', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '528 km' },
    { id: 'v011', brand: 'Nissan', model: 'Ariya', year: 2024, pricePerHour: 20, description: 'Sedán cruzado eléctrico con ProPilot', features: ['ProPilot 2.5', 'Carga rápida', 'Pantalla 12.3 pulgadas'], image: 'https://picsum.photos/seed/nissan/400/300', rating: 4.6, reviews: 298, location: 'Centro Comercial West', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '450 km' },
    { id: 'v012', brand: 'Lucid', model: 'Air Dream', year: 2024, pricePerHour: 45, description: 'Sedán de lujo ultra-silencioso', features: ['Conducción autónoma', 'Sonido envolvente', 'Asientos de masaje'], image: 'https://picsum.photos/seed/lucid/400/300', rating: 4.8, reviews: 145, location: 'Zona Premium', available: true, seats: 5, transmission: 'Automático', fuelType: 'Eléctrico', range: '560 km' },
  ];

  app.get('/vehicles', async (_req, res) => {
    try {
      const data = await getStoreData();
      const published = Array.isArray(data.vehicles) ? data.vehicles : [];
      let vehicles = [...vehicleCatalog];
      if (published.length > 0) {
        const mapped = published.map(v => ({
          id: v.id, brand: v.make || 'Marca', model: v.model || 'Modelo', year: new Date().getFullYear(),
          pricePerHour: v.pricePerHour || 0, description: `Publicado por ${v.owner || 'usuario'}`,
          features: [], image: 'https://picsum.photos/seed/car-default/400/300',
          rating: 0, reviews: 0, location: 'No especificada', available: true,
          seats: 4, transmission: 'Automático', fuelType: 'Eléctrico', range: 'N/A',
        }));
        vehicles = [...vehicles, ...mapped];
      }
      res.send({ ok: true, vehicles });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.get('/vehicles-catalog', (_req, res) => res.send({ ok: true, vehicles: vehicleCatalog }));

  app.post('/vehicles', async (req, res) => {
    try {
      const { owner, make, model, pricePerHour } = req.body;
      if (!owner || !make || !model) return res.status(400).send({ error: 'owner, make and model required' });
      const data = await getStoreData();
      data.vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
      data.vehicles.push({ id: base64url.encode(crypto.randomBytes(12)), owner, make, model, pricePerHour: pricePerHour || 0, createdAt: new Date().toISOString() });
      await saveStoreData(data);
      res.send({ ok: true });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/rentals', async (req, res) => {
    try {
      const { vehicleId, vehicle, userId, rentalDate } = req.body;
      if (!vehicleId || !userId) return res.status(400).send({ error: 'vehicleId and userId required' });
      const user = await getUser(userId);
      let paymentProcessed = false;
      if (user?.stellarSecretKey) {
        const price = (vehicle?.pricePerHour) || 10;
        const platformKey = process.env.PLATFORM_PUBLIC_KEY;
        if (platformKey) {
          try {
            const kp = Keypair.fromSecret(user.stellarSecretKey);
            const account = await stellarServer.loadAccount(kp.publicKey());
            const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
              .addOperation(Operation.payment({ destination: platformKey, asset: Asset.native(), amount: price.toString() }))
              .setTimeout(30).build();
            tx.sign(kp);
            await stellarServer.submitTransaction(tx);
            paymentProcessed = true;
          } catch (e) { return res.status(400).send({ error: `Payment failed: ${e.message}` }); }
        }
      }
      const data = await getStoreData();
      data.rentals = Array.isArray(data.rentals) ? data.rentals : [];
      const price = (vehicle?.pricePerHour) || 0;
      data.rentals.push({
        id: base64url.encode(crypto.randomBytes(12)), vehicleId, vehicle, userId,
        rentalDate: rentalDate || new Date().toISOString(), status: 'booked',
        paymentAmount: paymentProcessed ? price : 0, paymentCurrency: 'XLM',
      });
      await saveStoreData(data);
      res.send({ ok: true, paymentProcessed, paymentAmount: paymentProcessed ? price : 0, paymentCurrency: 'XLM' });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.get('/rentals/:username', async (req, res) => {
    try {
      const data = await getStoreData();
      const rentals = Array.isArray(data.rentals) ? data.rentals : [];
      res.send({ ok: true, rentals: rentals.filter((r) => r.userId === req.params.username) });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  app.post('/rentals/:id/cancel', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).send({ error: 'username required' });
      const data = await getStoreData();
      data.rentals = Array.isArray(data.rentals) ? data.rentals : [];
      const rental = data.rentals.find((r) => r.id === req.params.id);
      if (!rental) return res.status(404).send({ error: 'reservation not found' });
      if (rental.userId !== username) return res.status(403).send({ error: 'not authorized' });
      rental.status = 'canceled';
      rental.canceledAt = new Date().toISOString();
      await saveStoreData(data);
      res.send({ ok: true, rental });
    } catch (e) { res.status(500).send({ error: e.message }); }
  });

  return app;
}

const app = createApp();
export const handler = serverless(app);
