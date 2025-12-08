const form = document.getElementById('mediaUploadForm');
const alertBox = document.getElementById('mediaAlert');
if (form && alertBox) {
    const input = document.getElementById('mediaFiles');
    const dropZone = document.getElementById('dropZone');
    const preview = document.getElementById('mediaPreview');
    let sessionFiles = [];
    let selectedFiles = [];

    function refreshPreview() {
    if (!preview) return;
    preview.innerHTML = '';
    const combined = selectedFiles.concat(sessionFiles);
    combined.forEach((f, idx) => {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3';
        const card = document.createElement('div');
        card.className = 'card position-relative';
        const img = document.createElement('img');
        img.className = 'card-img-top';
        img.src = f.url;
        img.alt = f.name;
        card.appendChild(img);
        const body = document.createElement('div');
        body.className = 'card-body p-2 d-flex justify-content-between align-items-center';
        body.innerHTML = `<small class="text-muted text-truncate">${f.name}</small>`;
        if (idx < selectedFiles.length) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm position-absolute top-0 end-0 m-2 rounded-circle shadow';
            btn.style.backgroundColor = '#dc3545';
            btn.style.color = '#fff';
            btn.style.width = '32px';
            btn.style.height = '32px';
            btn.innerHTML = '&times;';
            btn.title = 'Remove';
            btn.addEventListener('click', () => {
                selectedFiles.splice(idx, 1);
                syncInput();
                refreshPreview();
            });
            card.appendChild(btn);
        }
        card.appendChild(body);
        col.appendChild(card);
        preview.appendChild(col);
    });
    }

    function handleFiles(files) {
    console.log('handleFiles received', files ? files.length : 0);
    Array.from(files || []).forEach((file) => {
        selectedFiles.push({
        name: file.name,
        url: URL.createObjectURL(file),
        file,
        });
    });
    syncInput();
    refreshPreview();
    }

    function syncInput() {
    const dt = new DataTransfer();
    selectedFiles.forEach((f) => dt.items.add(f.file));
    input.files = dt.files;
    }

    dropZone.addEventListener('click', () => input.click());
    dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--over'));
    dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
        console.log('drop event files', e.dataTransfer?.files?.length || 0);
        handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', (e) => {
        console.log('input change files', e.target.files ? e.target.files.length : 0);
    handleFiles(e.target.files);
    });

    form.addEventListener('submit', async function(e) {
    e.preventDefault();
    alertBox.style.display = 'none';
    alertBox.className = 'alert';

    const data = new FormData(form);
    try {
        const res = await fetch('/media/upload', { method: 'POST', body: data });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        alertBox.classList.add('alert-success');
        alertBox.textContent = 'Thanks! Files uploaded successfully.';
        alertBox.style.display = 'block';

        console.log('upload success', json);
        sessionFiles = sessionFiles.concat(
        selectedFiles.map((f) => ({ name: f.name, url: f.url }))
        );
        selectedFiles = [];
        refreshPreview();
        form.reset();
        syncInput();
    } catch (err) {
        console.error('upload error', err);
        alertBox.classList.add('alert-danger', 'mt-3');
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
    }
    });
}
