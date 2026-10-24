const https = require('https');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'assets', 'units');

// 需要下載真實照片的新武器清單及其最精準的搜尋關鍵字
const newUnits = [
  { id: 'J20', query: 'Chengdu J-20' },
  { id: 'RAFALE', query: 'Dassault Rafale C' },
  { id: 'F15EX', query: 'F-15EX Eagle II' },
  { id: 'JAS39', query: 'Saab JAS 39 Gripen' },
  { id: 'J10C', query: 'Chengdu J-10C' },
  { id: 'JF17', query: 'PAC JF-17 Thunder' },
  { id: 'F5E', query: 'Northrop F-5E Tiger II' },
  { id: 'YAK130', query: 'Yakovlev Yak-130' },
  { id: 'L159', query: 'Aero L-159 ALCA' },
  { id: 'T14', query: 'T-14 Armata tank' },
  { id: 'MK4', query: 'Merkava Mark IV tank' },
  { id: 'LEC', query: 'Leclerc tank XLR' },
  { id: 'T99A', query: 'Type 99A tank' },
  { id: 'BOXER', query: 'Boxer armored fighting vehicle' },
  { id: 'CM34', query: 'CM-34 Clouded Leopard' },
  { id: 'M113T', query: 'M113 TOW antitank' },
  { id: 'HMMWV', query: 'Humvee TOW missile' },
  { id: 'S500', query: 'S-500 missile system' },
  { id: 'DAVID', query: 'David Sling missile' },
  { id: 'TK3', query: 'Tien Kung III missile' },
  { id: 'IRIST', query: 'IRIS-T SLM' },
  { id: 'BUKM3', query: 'Buk-M3 missile' },
  { id: 'GEPARD', query: 'Flakpanzer Gepard' },
  { id: 'TC2', query: 'Tien Chien II missile' },
  { id: 'STAR', query: 'Starstreak missile' },
  { id: 'KDX3', query: 'Sejong the Great-class destroyer' },
  { id: 'TYPE45', query: 'Type 45 destroyer Daring' },
  { id: 'MOGAMI', query: 'Mogami-class frigate' },
  { id: 'YASEN', query: 'Yasen-class submarine' },
  { id: 'SORYU', query: 'Soryu-class submarine' },
  { id: 'GOWIND', query: 'Gowind-class corvette' },
  { id: 'SAAR6', query: 'Saar 6-class corvette' },
  { id: 'SBS', query: 'Swimmer Delivery Vehicle' },
  { id: 'KJ500', query: 'KJ-500 airborne early warning' },
  { id: 'RQ4', query: 'RQ-4 Global Hawk' },
  { id: 'ATACMS', query: 'MGM-140 ATACMS missile' },
  { id: 'STORM', query: 'Storm Shadow cruise missile' },
  { id: 'CAESAR', query: 'CAESAR self-propelled howitzer' },
  { id: 'ARCHER', query: 'Archer Artillery System' },
  { id: 'SW600', query: 'AeroVironment Switchblade' },
  { id: 'ORION', query: 'Kronshtadt Orion drone' },
  { id: 'SW300', query: 'Switchblade drone 300' },
  { id: 'MORTAR', query: 'Soltam K6 120 mm mortar' }
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MilitaryCardGameBot/1.0 (contact@example.com)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MilitaryCardGameBot/1.0 (contact@example.com)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Status ' + res.statusCode));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', err => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function searchAndDownload(item) {
  const dest = path.join(targetDir, `${item.id}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`[EXISTS] ${item.id}`);
    return;
  }

  const queryEnc = encodeURIComponent(item.query);
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${queryEnc}&gsrlimit=3&prop=pageimages&pithumbsize=600`;

  try {
    const data = await fetchJson(apiUrl);
    if (!data.query || !data.query.pages) {
      console.log(`[NOT FOUND] ${item.id} (${item.query})`);
      return;
    }
    const pages = Object.values(data.query.pages);
    const pageWithThumb = pages.find(p => p.thumbnail && p.thumbnail.source);
    if (!pageWithThumb) {
      console.log(`[NO THUMB] ${item.id}`);
      return;
    }

    const thumbUrl = pageWithThumb.thumbnail.source;
    await downloadImage(thumbUrl, dest);
    console.log(`[DOWNLOADED] ${item.id} <- ${thumbUrl}`);
  } catch (err) {
    console.error(`[ERROR] ${item.id}:`, err.message);
  }
}

async function main() {
  console.log(`Starting photo download for ${newUnits.length} units...`);
  for (const item of newUnits) {
    await searchAndDownload(item);
    // 稍微延遲避免頻率限制
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('Finished downloading photos!');
}

main();
