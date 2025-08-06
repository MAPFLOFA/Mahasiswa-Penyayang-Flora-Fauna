const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Setup upload folder
const upload = multer({ dest: 'uploads/' });
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // untuk akses preview dan form

// Load valid taksonomi
const taxonomy = JSON.parse(fs.readFileSync('valid-taxonomy.json', 'utf-8'));

// Template modular FLOTA/FLOFA
function generateHTML({ family, genus, species, desc, photoFilename }) {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>${genus} ${species}</title></head>
    <body>
      <h2>${genus} ${species}</h2>
      <h4>Family: ${family}</h4>
      <img src="../../../../uploads/${photoFilename}" width="300" />
      <p>${desc}</p>
    </body>
    </html>
  `;
}

// Validasi input
function isValidTaxonomy(family, genus) {
  return taxonomy.family.includes(family) &&
         taxonomy.genus[family] &&
         taxonomy.genus[family].includes(genus);
}

// Handle form + preview
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

// Handle upload
app.post('/upload', upload.single('photo'), (req, res) => {
  const { family, genus, species, desc } = req.body;
  const photoFilename = req.file.filename;

  // Validasi
  if (!isValidTaxonomy(family, genus)) {
    return res.send('❌ Family atau Genus tidak valid. Silakan cek kembali.');
  }

  // Tentukan folder target
  const folderPath = path.join(__dirname, 'data', 'flora', family, genus);
  const filePath = path.join(folderPath, `${species}.html`);

  // Buat folder jika belum ada
  fs.mkdirSync(folderPath, { recursive: true });

  // Buat file HTML spesies
  const htmlContent = generateHTML({ family, genus, species, desc, photoFilename });
  fs.writeFileSync(filePath, htmlContent);

  // Update index.html per genus
  const indexPath = path.join(folderPath, 'index.html');
  let indexContent = '';
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  } else {
    indexContent = `<h2>Genus: ${genus}</h2><ul>`;
  }
  indexContent += `<li><a href="${species}.html">${genus} ${species}</a></li>`;
  fs.writeFileSync(indexPath, indexContent);

  // Tampilkan preview langsung
  res.send(`
    <h2>✅ Kontribusi berhasil!</h2>
    <h3>Preview:</h3>
    ${htmlContent}
    <br><a href="/">Kembali ke Form</a>
  `);
});

app.listen(port, () => {
  console.log(`FLOTA/FLOFA uploader aktif di http://localhost:${port}`);
});