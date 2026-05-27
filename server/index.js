const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const base64url = require('base64url');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const rpName = 'ShareCar';
const rpID = 'localhost';
const origin = 'http://localhost:5173';

const dataFile = path.join(__dirname, 'data.json');
const challengeMap = new Map();

function readData() {
  if (!fs.existsSync(dataFile)) {
    return { users: [] };
  }

  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function saveUser(updatedUser) {
  const data = readData();
  const index = data.users.findIndex((user) => user.username === updatedUser.username);
  if (index >= 0) {
    data.users[index] = updatedUser;
  } else {
    data.users.push(updatedUser);
  }
  writeData(data);
}

// Vehicles storage inside data.json alongside users
function getVehicles() {
  const data = readData();
  return Array.isArray(data.vehicles) ? data.vehicles : [];
}

function saveVehicle(vehicle) {
  const data = readData();
  data.vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  data.vehicles.push(vehicle);
  writeData(data);
}

function getUser(username) {
  const data = readData();
  return data.users.find((user) => user.username === username) || null;
}

function createPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword?.salt || !storedPassword?.hash) {
    return false;
  }

  const hash = crypto.scryptSync(password, storedPassword.salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedPassword.hash, 'hex'));
}

function toCredentialList(user) {
  return (user.credentials || []).map((credential) => ({
    id: credential.id,
    type: 'public-key',
  }));
}

function getAuthenticator(user, credentialID) {
  const credential = (user.credentials || []).find((item) => item.id === credentialID);
  if (!credential) {
    return null;
  }

  return {
    credentialID: base64url.toBuffer(credential.id),
    credentialPublicKey: base64url.toBuffer(credential.publicKey),
    counter: credential.counter,
  };
}

app.get('/', (_req, res) => res.send({ ok: true }));

app.post('/users', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send({ error: 'username and password required' });
  }

  const existing = getUser(username);
  if (existing) {
    return res.status(400).send({ error: 'user exists' });
  }

  const user = {
    id: base64url.encode(crypto.randomBytes(16)),
    username,
    password: createPassword(password),
    credentials: [],
  };

  saveUser(user);
  res.send({ ok: true, user: { id: user.id, username: user.username } });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send({ error: 'username and password required' });
  }

  const user = getUser(username);
  if (!user) {
    return res.status(400).send({ error: 'user not found' });
  }

  if (!verifyPassword(password, user.password)) {
    return res.status(400).send({ error: 'invalid credentials' });
  }

  res.send({ ok: true, user: { id: user.id, username: user.username } });
});

app.post('/register/options', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send({ error: 'username required' });
  }

  const user = getUser(username);
  if (!user) {
    return res.status(400).send({ error: 'user not found' });
  }

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.username,
    attestationType: 'direct',
    authenticatorSelection: {
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
    supportedAlgorithmIDs: [-7],
    timeout: 60000,
    excludeCredentials: toCredentialList(user),
  });

  challengeMap.set(username, options.challenge);
  res.send(options);
});

app.post('/register/verify', async (req, res) => {
  const { username, attestation } = req.body;
  if (!username || !attestation) {
    return res.status(400).send({ error: 'missing data' });
  }

  const user = getUser(username);
  if (!user) {
    return res.status(400).send({ error: 'user not found' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: challengeMap.get(username),
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      const credential = {
        id: base64url.encode(Buffer.from(credentialID)),
        publicKey: base64url.encode(Buffer.from(credentialPublicKey)),
        counter,
      };

      user.credentials = user.credentials || [];
      user.credentials.push(credential);
      saveUser(user);
    }

    res.send({ ok: verification.verified });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.message });
  }
});

app.post('/auth/options', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send({ error: 'username required' });
  }

  const user = getUser(username);
  if (!user) {
    return res.status(400).send({ error: 'user not found' });
  }

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
  if (!username || !assertion) {
    return res.status(400).send({ error: 'missing data' });
  }

  const user = getUser(username);
  if (!user) {
    return res.status(400).send({ error: 'user not found' });
  }

  try {
    const authenticator = getAuthenticator(user, assertion.id);
    if (!authenticator) {
      return res.status(400).send({ error: 'credential not found' });
    }

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengeMap.get(username),
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator,
    });

    if (verification.verified && verification.authenticationInfo) {
      const index = (user.credentials || []).findIndex((item) => item.id === assertion.id);
      if (index >= 0) {
        user.credentials[index].counter = verification.authenticationInfo.newCounter;
        saveUser(user);
      }
    }

    res.send({ ok: verification.verified });
  } catch (error) {
    console.error(error);
    res.status(400).send({ error: error.message });
  }
});

// Endpoint para recibir foto de rostro y guardarla en el usuario
app.post('/users/photo', (req, res) => {
  const { username, image } = req.body;
  if (!username || !image) {
    return res.status(400).send({ error: 'username and image required' });
  }

  const user = getUser(username);
  if (!user) {
    return res.status(400).send({ error: 'user not found' });
  }

  // Guardamos la imagen (base64 data URL) en el registro del usuario
  user.faceImage = image;
  saveUser(user);

  res.send({ ok: true });
});

// Cargar catálogo de vehículos
function loadVehicleCatalog() {
  try {
    const catalogPath = path.join(__dirname, 'vehicles-catalog.json');
    if (fs.existsSync(catalogPath)) {
      const raw = fs.readFileSync(catalogPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Error loading vehicle catalog:', error);
  }
  return [];
}

const vehicleCatalog = loadVehicleCatalog();

// Listar vehículos disponibles (catálogo)
app.get('/vehicles', (_req, res) => {
  // Si no hay vehículos publicados, devolver el catálogo
  const publishedVehicles = getVehicles();
  const vehicles = publishedVehicles.length > 0 ? publishedVehicles : vehicleCatalog;
  res.send({ ok: true, vehicles });
});

// Obtener catálogo completo
app.get('/vehicles-catalog', (_req, res) => {
  res.send({ ok: true, vehicles: vehicleCatalog });
});

// Publicar vehículo
app.post('/vehicles', (req, res) => {
  const { owner, make, model, pricePerHour, currency } = req.body;
  if (!owner || !make || !model) {
    return res.status(400).send({ error: 'owner, make and model required' });
  }

  const vehicle = {
    id: base64url.encode(crypto.randomBytes(12)),
    owner,
    make,
    model,
    pricePerHour: pricePerHour || 0,
    currency: currency || 'XLM',
    createdAt: new Date().toISOString(),
  };

  saveVehicle(vehicle);
  res.send({ ok: true, vehicle });
});

// Guardar rental
app.post('/rentals', (req, res) => {
  const { vehicleId, vehicle, userId, rentalDate } = req.body;
  if (!vehicleId || !userId) {
    return res.status(400).send({ error: 'vehicleId and userId required' });
  }

  const data = readData();
  data.rentals = Array.isArray(data.rentals) ? data.rentals : [];
  
  const rental = {
    id: base64url.encode(crypto.randomBytes(12)),
    vehicleId,
    vehicle,
    userId,
    rentalDate: rentalDate || new Date().toISOString(),
    status: 'booked',
  };

  data.rentals.push(rental);
  writeData(data);

  res.send({ ok: true, rental });
});

// Obtener rentals del usuario
app.get('/rentals/:username', (req, res) => {
  const { username } = req.params;
  const data = readData();
  const rentals = Array.isArray(data.rentals) ? data.rentals : [];
  const userRentals = rentals.filter(r => r.userId === username);
  
  res.send({ ok: true, rentals: userRentals });
});

const port = 4000;
app.listen(port, () => {
  console.log(`WebAuthn demo server listening on http://localhost:${port}`);
  console.log(`Vehicle catalog loaded: ${vehicleCatalog.length} vehicles`);
});
