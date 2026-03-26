const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const MODELS_DIR = path.join(__dirname, 'public', 'models');

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

async function downloadFile(filename) {
  const fileUrl = BASE_URL + filename;
  const dest = path.join(MODELS_DIR, filename);

  return new Promise((resolve, reject) => {
    https.get(fileUrl, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded: ${filename}`);
          resolve();
        });
      } else {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // GitHub wraps redirects
          https.get(response.headers.location, (res) => {
             const file = fs.createWriteStream(dest);
             res.pipe(file);
             file.on('finish', () => {
               file.close();
               console.log(`Downloaded: ${filename}`);
               resolve();
             });
          }).on('error', reject);
        } else {
          reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
        }
      }
    }).on('error', reject);
  });
}

async function downloadAll() {
  console.log('Starting Face API model downloads...');
  for (const file of files) {
    try {
      await downloadFile(file);
    } catch (e) {
      console.error(e.message);
    }
  }
  console.log('All downloads completed!');
}

downloadAll();
