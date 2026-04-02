// ===== STATUS MAP =====
const STATUS_MAP = {
  1: { text: "In Stock", class: "badge-success" },
  2: { text: "Low Stock", class: "badge-warning" },
  3: { text: "Out of Stock", class: "badge-danger" },
  4: { text: "Reserved", class: "badge-primary" },
  5: { text: "Inactive", class: "badge-secondary" }
};

let allMaterials = [];

// =====  MAIN INITIALIZATION =====
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // โหลด User และวาด Sidebar
    if (typeof loadUser === "function") await loadUser();
    if (typeof renderSidebar === "function") renderSidebar();

    // ตรวจสอบสิทธิ์การมองเห็นหน้านี้
    if (!hasPermission("view_materials")) {
      await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      window.location.href = "/home/home.html";
      return;
    }

    // จัดการปุ่ม ADD ตามสิทธิ์
    const addBtn = document.getElementById("addMaterialBtn");
    if (addBtn) {
      addBtn.style.display = hasPermission("create_materials") ? "block" : "none";
    }

    // โหลดข้อมูลและเตรียม UI
    await loadMaterials();
    setupStatusDropdown();
    setupSearch();

  } catch (err) {
    console.error("Initialization Error:", err);
  }
});

// ===== FETCH DATA =====
async function loadMaterials() {
  const tbody = document.getElementById("materials-body");
  if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="text-center">⌛ Loading...</td></tr>';

  try {
    const res = await fetch("/materials", { credentials: "include" });
    const data = await res.json();
    
    // เรียงลำดับตามความใหม่ (สมมติใช้ id หรือวันที่)
    allMaterials = data.sort((a, b) => b.mat_id - a.mat_id); 
    
    renderTable(allMaterials);
  } catch (err) {
    console.error("Load materials error:", err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">❌ Error loading data</td></tr>';
  }
}

// ===== RENDER TABLE =====
function renderTable(materials) {
  const tbody = document.getElementById("materials-body");
  if (!tbody) return;

  let html = "";
  const canEdit = hasPermission("edit_materials");
  const canDelete = hasPermission("edit_materials");

  materials.forEach((m, index) => {
    const status = STATUS_MAP[m.mat_status] || { text: "Unknown", class: "badge-light" };

    const imgSrc = (m.mat_img && m.mat_img !== "null")
      ? (m.mat_img.startsWith('/') || m.mat_img.startsWith('http') ? m.mat_img : `/img/materials/${m.mat_img}`)
      : null;
    const imgTag = imgSrc
      ? `<img src="${imgSrc}" class="mat-thumb" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=mat-thumb-placeholder><i class=fa fa-image></i></div>'">`
      : `<div class="mat-thumb-placeholder"><i class="fa fa-image"></i></div>`;

    html += `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td class="text-center">${imgTag}</td>
        <td><strong>${m.mat_name || "-"}</strong><br><span class="mat-code">${m.mat_no || ""}</span></td>
        <td>${m.mat_size || "-"}</td>
        <td>${m.mat_weight != null ? m.mat_weight + " kg" : "-"}</td>
        <td class="text-right">${Number(m.mat_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="text-right">${(m.mat_qty || 0).toLocaleString()}</td>
        <td><span class="badge ${status.class}">${status.text}</span></td>
        <td class="text-center">
          ${canEdit ? `<button class="edit-btn" onclick="goEdit(${m.mat_id})" title="Edit"><i class="fa fa-pen"></i></button>` : ""}
          ${canDelete ? `<button class="delete-btn" onclick="deleteMaterial(${m.mat_id})" title="Delete" style="margin-left:6px"><i class="fa fa-trash"></i></button>` : ""}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html || '<tr><td colspan="9" class="text-center">ไม่พบข้อมูลที่ค้นหา</td></tr>';
}

// ===== SEARCH & FILTER LOGIC =====
function setupStatusDropdown() {
  const select = document.getElementById("statusFilter");
  if (!select) return;

  let options = `<option value="">-- All Status --</option>`;
  Object.entries(STATUS_MAP).forEach(([key, value]) => {
    options += `<option value="${key}">${value.text}</option>`;
  });
  select.innerHTML = options;
  select.addEventListener("change", applyFilters);
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  input.addEventListener("input", (e) => {
    // ใช้ 'input' event แทน 'keyup' เพื่อให้ล้างค่าได้ทันทีเมื่อกดกากบาทในช่อง Search
    applyFilters();
  });
}

function applyFilters() {
  const keyword = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const selectedStatus = document.getElementById("statusFilter")?.value || "";

  const filtered = allMaterials.filter(m => {
    const matchKeyword = 
      (m.mat_no || "").toLowerCase().includes(keyword) || 
      (m.mat_name || "").toLowerCase().includes(keyword);
    
    const matchStatus = !selectedStatus || String(m.mat_status) === selectedStatus;

    return matchKeyword && matchStatus;
  });

  renderTable(filtered);
}

// ===== NAVIGATION =====
function goEdit(matId) {
  if (!hasPermission("edit_materials")) { swalError("คุณไม่มีสิทธิ์แก้ไข"); return; }
  window.location.href = `/materials/materials-edit.html?id=${matId}`;
}

document.getElementById("addMaterialBtn")?.addEventListener("click", () => {
  if (!hasPermission("create_materials")) { swalError("คุณไม่มีสิทธิ์เพิ่มข้อมูล"); return; }
  window.location.href = "/materials/materials-add.html";
});

// ===== DELETE ACTION =====
async function deleteMaterial(matId) {
  if (!hasPermission("delete_materials")) { await swalError("คุณไม่มีสิทธิ์ลบข้อมูล"); return; }

  const { isConfirmed } = await swalConfirm("ยืนยันการลบวัตถุดิบนี้? (การลบจะไม่สามารถเรียกคืนได้)");
  if (!isConfirmed) return;

  try {
    const res = await fetch(`/materials/${matId}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (res.ok) {
      await swalSuccess("ลบข้อมูลเรียบร้อยแล้ว");
      allMaterials = allMaterials.filter(m => m.mat_id !== matId);
      applyFilters(); 
    } else {
      const result = await res.json();
      await swalError(result.message || "ลบไม่สำเร็จ");
    }
  } catch (err) {
    console.error("Delete error:", err);
    await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  }
}