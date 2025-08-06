const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 3000;

// Setup upload folder
const upload = multer({ dest: 'uploads/' });

// Template HTML modular FLOTA/FLOFA
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

// Handle form submission
app.post('/upload', upload.single('photo'), (req, res) => {
  const { family, genus, species, desc } = req.body;
  const photoFilename = req.file.filename;

  // Tentukan folder target
  const folderPath = path.join(__dirname, 'data', 'flora', family, genus);
  const filePath = path.join(folderPath, `${species}.html`);

  // Buat folder jika belum ada
  fs.mkdirSync(folderPath, { recursive: true });

  // Buat file HTML spesies
  const htmlContent = generateHTML({ family, genus, species, desc, photoFilename });
  fs.writeFileSync(filePath, htmlContent);

  // Update index.html di folder genus
  const indexPath = path.join(folderPath, 'index.html');
  let indexContent = '';
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  } else {
    indexContent = `<h2>Genus: ${genus}</h2><ul>`;
  }
  indexContent += `<li><a href="${species}.html">${genus} ${species}</a></li>`;
  fs.writeFileSync(indexPath, indexContent);

  res.send('Kontribusi berhasil disimpan dan ditampilkan di FLOTA/FLOFA!');
});

app.listen(port, () => {
  console.log(`FLOTA/FLOFA uploader running at http://localhost:${port}`);
});