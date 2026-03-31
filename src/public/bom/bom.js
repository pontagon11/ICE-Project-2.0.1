let allBoms = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
  // โหลดข้อมูล User และวาด Sidebar
  if (typeof loadUser === "function") {
    await loadUser();
  }

  if (typeof renderSidebar === "function") {
    renderSidebar();
  }

  // GUARD PAGE: เช็กสิทธิ์การดู BOM
  if (typeof hasPermission === "function") {
    if (!hasPermission("view_bom")) {
      await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้ารายการสูตรการผลิต");
      window.location.href = "/home/home.html";
      return;
    }
  }

  // เริ่มโหลดข้อมูลและตั้งค่า UI
  loadBoms();
  setupSearch();
  setupAddButton();
});

/* ====================== FETCH DATA ====================== */
async function loadBoms() {
  try {
    const tbody = document.getElementById("bomTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center">⌛ Loading BOMs...</td></tr>`;

    const res = await fetch("/bom", { credentials: "include" });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Failed to fetch");

    allBoms = data; // ข้อมูลดิบจาก DB
    renderTable(allBoms);

  } catch (err) {
    console.error("Load BOM error:", err);
    const tbody = document.getElementById("bomTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>`;
  }
}

/* ====================== RENDER TABLE (WITH GROUPING) ====================== */
function renderTable(data) {
  const tbody = document.getElementById("bomTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Group data ตาม bom_id (Master-Detail Structure)
  const grouped = {};
  data.forEach(row => {
    if (!grouped[row.bom_id]) {
      grouped[row.bom_id] = {
        bom_id: row.bom_id,
        bom_no: row.bom_no,
        pro_no: row.pro_no,
        pro_name: row.pro_name,
        materials: []
      };
    }
    if (row.mat_id) { // ตรวจสอบว่ามีข้อมูลวัตถุดิบติดมาด้วยไหม
      grouped[row.bom_id].materials.push(row);
    }
  });

  const boms = Object.values(grouped);

  if (boms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">ไม่พบข้อมูลสูตรการผลิต</td></tr>`;
    return;
  }

  const canEdit = typeof hasPermission === "function" && hasPermission("edit_bom");
  const canDelete = typeof hasPermission === "function" && hasPermission("edit_bom");

  boms.forEach(bom => {
    // --- (Header) ---
    const headerRow = `
            <tr class="bom-header-row" style="background-color: #f8f9fa; font-weight: bold;">
                <td>${bom.bom_no}</td>
                <td>${bom.pro_no}</td>
                <td>${bom.pro_name}</td>
                <td class="text-center">
                    ${canEdit ? `<button class="btn-icon edit-btn" onclick="editBom(${bom.bom_id})">✏️</button>` : "-"}
                </td>
                <td class="text-center">
                    ${canDelete ? `<button class="btn-icon delete-btn" onclick="deleteBOM(${bom.bom_id})">🗑️</button>` : "-"}
                </td>
            </tr>
        `;
    // --- (Detail) ---
    const detailRow = `
   <tr class="bom-detail-row">
      <td colspan="5" style="padding: 10px 30px;">
          <table class="table table-sm table-bordered" style="background: white; margin-bottom: 20px;">
              <thead class="thead-light">
                  <tr>
                      <th>Material No</th>
                      <th>Material Name</th>
                      <th class="text-right">Usage Qty</th>
                    </tr>
               </thead>
                <tbody>
                    ${bom.materials.map(m => `
                    <tr>
                    <td>${m.mat_no || '-'}</td>
                    <td>${m.mat_name || '-'}</td>
                    <td class="text-right">${Number(m.usage_qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    `).join("")}
                </tbody>
           </table>
      </td>
    </tr>
        `;
    tbody.innerHTML += headerRow + detailRow;
  });
}

/* ====================== SEARCH & FILTER ====================== */
function setupSearch() {
    const searchBtn = document.querySelector(".search-box button");
    if (!searchBtn) return;

    searchBtn.addEventListener("click", () => {
        const inputs = document.querySelectorAll(".search-bar");
        const codeQuery = inputs[0]?.value.toLowerCase().trim() || "";
        const nameQuery = inputs[1]?.value.toLowerCase().trim() || "";

        const filtered = allBoms.filter(bom => {
            const matchCode = (bom.pro_no || "").toLowerCase().includes(codeQuery);
            const matchName = (bom.pro_name || "").toLowerCase().includes(nameQuery);
            return matchCode && matchName;
        });
        renderTable(filtered);
    });
}

/* ====================== DELETE ACTION ====================== */
async function deleteBOM(bomId) {
    const { isConfirmed } = await swalConfirm("คุณต้องการลบสูตรการผลิต (BOM) ทั้งหมดของสินค้านี้? การลบจะไม่สามารถย้อนคืนได้", "ยืนยันการลบ BOM");
    if (!isConfirmed) return;

    try {
        const res = await fetch(`/bom/group/${bomId}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("ลบสูตรการผลิตเรียบร้อยแล้ว");
            loadBoms();
        } else {
            const result = await res.json();
            await swalError(result.message || "ลบไม่สำเร็จ");
        }
    } catch (err) {
        console.error("Delete Error:", err);
        await swalError("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
    }
}

/* ====================== ADD BUTTON CONFIG ====================== */
function setupAddButton() {
    const addBtn = document.getElementById("addBomBtn");
    if (!addBtn) return;

    if (typeof hasPermission === "function" && !hasPermission("create_bom")) {
        addBtn.style.display = "none";
    }

    addBtn.onclick = () => window.location.href = "/bom/bom-add.html";
}

// Helper functions สำหรับการเปลี่ยนหน้า
function editBom(bomId) {
    window.location.href = `/bom/bom-edit.html?id=${bomId}`;
}