let taxonomy;

fetch('valid-taxonomy.json')
  .then(res => res.json())
  .then(data => {
    taxonomy = data;
    populateFamilyList();
  });

function populateFamilyList() {
  const familyList = document.getElementById('familyList');
  taxonomy.family.forEach(f => {
    const option = document.createElement('option');
    option.value = f;
    familyList.appendChild(option);
  });
}

document.getElementById('family').addEventListener('input', e => {
  const selectedFamily = e.target.value;
  const genusList = document.getElementById('genusList');
  genusList.innerHTML = '';
  if (taxonomy.genus[selectedFamily]) {
    taxonomy.genus[selectedFamily].forEach(g => {
      const option = document.createElement('option');
      option.value = g;
      genusList.appendChild(option);
    });
  }
});

function showPreview() {
  const family = document.getElementById('family').value;
  const genus = document.getElementById('genus').value;
  const species = document.getElementById('species').value;
  const desc = document.getElementById('desc').value;
  const photo = document.getElementById('photo').files[0];

  const reader = new FileReader();
  reader.onload = function () {
    const previewWindow = window.open('', 'Preview');
    previewWindow.document.write(`
      <h2>${genus} ${species}</h2>
      <h4>Family: ${family}</h4>
      <img src="${reader.result}" width="300" />
      <p>${desc}</p>
    `);
  };
  if (photo) reader.readAsDataURL(photo);
}