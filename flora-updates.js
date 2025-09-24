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

// js/flora_app.js
(() => {
  // helper: baca localStorage
  function loadList(){ return JSON.parse(localStorage.getItem('flora_list')||'[]'); }
  function saveList(list){ localStorage.setItem('flora_list', JSON.stringify(list)); }

  // generate id sederhana
  function genId(){ return 's'+Date.now()+Math.floor(Math.random()*1000); }

  // parse KML text -> array of [lat, lon] points (flatten)
  function parseKMLText(kmlText){
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "application/xml");
    const coords = [...xml.querySelectorAll('coordinates')];
    const points = [];
    coords.forEach(node => {
      const txt = node.textContent.trim();
      // coordinates may contain multiple tuples separated by spaces/newlines
      const parts = txt.split(/\s+/);
      parts.forEach(p=>{
        p = p.trim();
        if(!p) return;
        const comps = p.split(',');
        const lon = parseFloat(comps[0]);
        const lat = parseFloat(comps[1]);
        if(!isNaN(lat) && !isNaN(lon)) points.push([lat, lon]);
      });
    });
    return points;
  }

  // read image files -> base64 (async)
  function readFilesAsDataURL(files){
    const readers = Array.from(files).map(f => new Promise((res,rej)=>{
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.onerror = ()=>rej();
      r.readAsDataURL(f);
    }));
    return Promise.all(readers);
  }

  // --- UI logic for flora.html (family list + upload + list) ---
  function initFloraPage(){
    const familyListEl = document.getElementById('family-list');
    const families = ['Dipterocarpaceae','Myrtaceae','Moraceae','Fabaceae','Other'];
    familyListEl.innerHTML = families.map(f=>`<button class="fam-btn" data-family="${f}">${f}</button>`).join(' ');

    // filter control
    const filter = document.getElementById('filter-family');
    const speciesCards = document.getElementById('species-cards');

    function renderList(){
      const list = loadList();
      const sel = filter ? filter.value : '';
      const filtered = sel? list.filter(x=>x.family===sel):list;
      speciesCards.innerHTML = filtered.map(item=>{
        const thumb = item.photos && item.photos[0] ? `<img src="${item.photos[0]}">` : '<div style="height:150px;background:#eee;display:flex;align-items:center;justify-content:center">No Image</div>';
        return `<div class="card">
          ${thumb}
          <h3>${item.name}</h3>
          <p><b>Family:</b> ${item.family}</p>
          <p><b>Status:</b> ${item.iucn||'-'}</p>
          <p>${(item.desc||'')}</p>
          <p><a href="species.html?id=${item.id}">Lihat detail</a></p>
        </div>`;
      }).join('') || '<p>Tidak ada data.</p>';
    }

    if(filter) filter.onchange = renderList;
    renderList();

    // when family button clicked, set filter
    familyListEl.addEventListener('click', e=>{
      if(e.target.matches('.fam-btn')){
        const f = e.target.dataset.family;
        if(filter){ filter.value = f; renderList(); }
      }
    });

    // upload form
    const form = document.getElementById('uploadForm');
    if(form){
      form.addEventListener('submit', async (evt)=>{
        evt.preventDefault();
        const family = document.getElementById('field-family').value.trim();
        const name = document.getElementById('field-name').value.trim();
        if(!family || !name){ alert('Isi family dan nama jenis!'); return; }

        // classification
        const klass = {
          kingdom: document.getElementById('f-kingdom').value.trim(),
          phylum: document.getElementById('f-phylum').value.trim(),
          class: document.getElementById('f-class').value.trim(),
          order: document.getElementById('f-order').value.trim(),
          family: document.getElementById('f-family').value.trim(),
          genus: document.getElementById('f-genus').value.trim()
        };

        const desc = document.getElementById('field-desc').value.trim();
        const distr = document.getElementById('field-distr').value.trim();
        const iucn = document.getElementById('field-iucn').value;
        const p106 = document.getElementById('field-p106').value;
        const cites = document.getElementById('field-cites').value;

        // photos
        const photoFiles = document.getElementById('field-photos').files;
        let photos = [];
        if(photoFiles && photoFiles.length>0){
          try {
            photos = await readFilesAsDataURL(photoFiles); // may be large
          } catch(e){
            console.warn('Gagal baca foto', e);
          }
        }

        // parse KML files
        const kmlFiles = document.getElementById('field-kml').files;
        let kmlPoints = [];
        if(kmlFiles && kmlFiles.length>0){
          for(const f of kmlFiles){
            const txt = await new Promise((res,rej)=>{
              const r = new FileReader();
              r.onload = ()=>res(r.result);
              r.onerror = ()=>rej();
              r.readAsText(f);
            });
            const pts = parseKMLText(txt);
            if(pts && pts.length) kmlPoints = kmlPoints.concat(pts);
          }
        }

        // assemble item
        const item = {
          id: genId(),
          family, name, classification: klass,
          desc, distr, iucn, p106, cites,
          photos, kmlPoints, created: new Date().toISOString()
        };

        // save
        const list = loadList();
        list.unshift(item);
        saveList(list);

        alert('Data tersimpan lokal. Lihat di daftar.');
        form.reset();
        // re-render list
        renderList();
      });
    }
  }

  // --- species detail page (species.html) ---
  function initSpeciesPage(){
    // read id param
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if(!id) return;
    const list = loadList();
    const item = list.find(i=>i.id===id);
    if(!item) {
      document.getElementById('sp-title').textContent = 'Data tidak ditemukan';
      return;
    }

    // populate
    document.getElementById('sp-title').textContent = item.name;
    const photosEl = document.getElementById('photos');
    photosEl.innerHTML = (item.photos || []).map(p=>`<img src="${p}" style="max-width:200px;margin-right:8px;margin-bottom:8px">`).join('') || '<p>Tidak ada foto.</p>';

    // classification
    const cls = item.classification || {};
    const clEl = document.getElementById('classification');
    clEl.innerHTML = Object.entries(cls).filter(([k,v])=>v).map(([k,v])=>`<li><b>${k}:</b> ${v}</li>`).join('') || '<li>Tidak tersedia</li>';

    document.getElementById('desc').textContent = item.desc || '-';
    document.getElementById('distr').textContent = item.distr || '-';
    document.getElementById('iucn').textContent = 'IUCN: ' + (item.iucn || '-');
    document.getElementById('p106').textContent = 'P.106: ' + (item.p106 || '-');
    document.getElementById('cites').textContent = 'CITES: ' + (item.cites || '-');

    // map for KML points (persebaran)
    const mapEl = document.getElementById('map');
    const map = L.map(mapEl).setView(item.kmlPoints && item.kmlPoints.length? item.kmlPoints[0] : [0,117], item.kmlPoints && item.kmlPoints.length? 8 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);
    if(item.kmlPoints && item.kmlPoints.length){
      const group = L.featureGroup(item.kmlPoints.map(p=>L.marker(p))).addTo(map);
      map.fitBounds(group.getBounds().pad(0.5));
    } else {
      // no points: leave default view
    }

    // map of points with Google Maps link
    const mapPointsEl = document.getElementById('mapPoints');
    const map2 = L.map(mapPointsEl).setView(item.kmlPoints && item.kmlPoints.length? item.kmlPoints[0] : [0,117], item.kmlPoints && item.kmlPoints.length? 8 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map2);
    if(item.kmlPoints && item.kmlPoints.length){
      item.kmlPoints.forEach((p, idx)=>{
        const m = L.marker(p).addTo(map2).bindPopup(`<b>Titik ${idx+1}</b><br><a href="https://www.google.com/maps?q=${p[0]},${p[1]}" target="_blank">Buka di Google Maps</a>`);
      });
      const group = L.featureGroup(item.kmlPoints.map(p=>L.marker(p)));
      map2.fitBounds(group.getBounds().pad(0.5));
      document.getElementById('googlelink').href = `https://www.google.com/maps?q=${item.kmlPoints[0][0]},${item.kmlPoints[0][1]}`;
    } else {
      document.getElementById('googlelink').style.display = 'none';
    }
  }

  // --- titik.html page: show all points from all species ---
  function initTitikPage(){
    const mapAllEl = document.getElementById('mapAll');
    if(!mapAllEl) return;
    const map = L.map(mapAllEl).setView([0,117],5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(map);

    const list = loadList();
    const allPoints = [];
    list.forEach(item=>{
      if(item.kmlPoints && item.kmlPoints.length){
        item.kmlPoints.forEach((p, idx)=>{
          const marker = L.marker(p).addTo(map).bindPopup(`<b>${item.name}</b><br>Family: ${item.family}<br><a href="species.html?id=${item.id}">Lihat detail</a><br><a href="https://www.google.com/maps?q=${p[0]},${p[1]}" target="_blank">Buka di Google Maps</a>`);
          allPoints.push(marker);
        });
      }
    });
    if(allPoints.length) {
      const group = L.featureGroup(allPoints.map(m=>m));
      map.fitBounds(group.getBounds().pad(0.5));
    }
  }

  // bootstrap based on page
  document.addEventListener('DOMContentLoaded', ()=>{
    if(document.getElementById('uploadForm')) initFloraPage();
    if(document.getElementById('sp-title')) initSpeciesPage();
    if(document.getElementById('mapAll')) initTitikPage();
  });

})();
