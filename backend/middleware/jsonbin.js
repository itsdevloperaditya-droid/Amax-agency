const https = require('https');

const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

function jsonbinRequest(method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(method === 'GET' ? `${JSONBIN_URL}/latest` : JSONBIN_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Meta': 'false'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`JSONBin parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function readJSONBin(key) {
  try {
    const data = await jsonbinRequest('GET');
    return data[key] || [];
  } catch (err) {
    console.log(`JSONBin read error for ${key}:`, err.message);
    return [];
  }
}

async function writeJSONBin(key, value) {
  try {
    const existing = await jsonbinRequest('GET');
    const updated = { ...existing, [key]: value };
    await jsonbinRequest('PUT', updated);
  } catch (err) {
    console.log(`JSONBin write error for ${key}:`, err.message);
  }
}

module.exports = { readJSONBin, writeJSONBin };
