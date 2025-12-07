
(() => {
  const grid = document.getElementById("galleryGrid");
  const status = document.getElementById("galleryStatus");
  const modalEl = document.getElementById("lightboxModal");
  const modalImg = document.getElementById("lightboxImage");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  if (!grid || !status) return;

  let page = 1;
  const pageSize = 20;
  let loading = false;
  let done = false;

  function setStatus(text) {
    status.textContent = text || "";
  }

  async function fetchPage() {
    if (loading || done) return;
    loading = true;
    setStatus("Loading photos...");
    try {
      const res = await fetch(`/media/api/uploads?page=${page}&pageSize=${pageSize}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load photos");

      if (!json.files || json.files.length === 0) {
        if (page === 1) setStatus("No uploads yet.");
        done = true;
        return;
      }

      json.files.forEach((file) => {
        const item = document.createElement("div");
        item.className = "masonry-item";

        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = file.thumbUrl || file.url;
        img.alt = file.name;
        item.appendChild(img);

        const name = document.createElement("small");
        name.classList.add("d-none");
        name.textContent = file.name;
        item.appendChild(name);

        item.addEventListener("click", () => {
          if (!modal || !modalImg) return;
          modalImg.src = file.url;
          modalImg.alt = file.name;
          modal.show();
        });

        grid.appendChild(item);
      });

      page += 1;
      done = !json.hasMore;
      setStatus(done ? "You've reached the end." : "");
    } catch (err) {
      console.error("Failed to fetch gallery", err);
      setStatus(err.message);
    } finally {
      loading = false;
    }
  }

  function onScroll() {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
    if (nearBottom) fetchPage();
  }

  window.addEventListener("scroll", onScroll);
  fetchPage();
})();
