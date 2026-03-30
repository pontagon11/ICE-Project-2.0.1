// ===== TYPE MAP =====
const TYPE_MAP = {
  IN: { text: "📥 IN", class: "badge-in" },
  OUT: { text: "📤 OUT", class: "badge-out" }
};

let allTransactions = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
  // โหลดข้อมูล User และวาด Sidebar
  if (typeof loadUser === "function") {
    await loadUser();
  }
  
  if (typeof renderSidebar === "function") {
    renderSidebar();
  }

  // GUARD PAGE: เช็กสิทธิ์การมองเห็นประวัติ
  if (typeof hasPermission === "function") {
    if (!hasPermission("view_transactions")) {
      alert("❌ คุณไม่มีสิทธิ์เข้าถึงหน้าประวัติรายการ");
      window.location.href = "home.html";
      return;
    }
  }

  // เริ่มต้นโหลดข้อมูลและตั้งค่า UI
  loadTransactions();
  setupTypeDropdown();
  setupSearch();

  // ผูกปุ่มเพิ่มรายการ
  document.getElementById("addTransactionBtn")?.addEventListener("click", () => {
    window.location.href = "add-transaction.html";
  });
});

/* ====================== FETCH DATA ====================== */
async function loadTransactions() {
  try {
    const tbody = document.getElementById("historyTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center">⌛ Loading Transactions...</td></tr>`;

    const res = await fetch("/transactions", { credentials: "include" });

    if (res.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const result = await res.json();
    // รองรับทั้งโครงสร้าง { data: [] } หรือ []
    allTransactions = result.data || result || [];
    renderTable(allTransactions);

  } catch (err) {
    console.error("Load transactions error:", err);
    const tbody = document.getElementById("historyTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Failed to load data</td></tr>`;
  }
}

/* ====================== RENDER TABLE ====================== */
function renderTable(transactions) {
  const tbody = document.getElementById("historyTable");
  if (!tbody) return;

  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  // เช็กสิทธิ์การจัดการ (ลบ/แก้ไข)
  const canEdit = typeof hasPermission === "function" && hasPermission("create_transactions");
  const canDelete = typeof hasPermission === "function" && hasPermission("manage_permissions"); // หรือสิทธิ์ delete_transaction

  transactions.forEach((t) => {
    const tr = document.createElement("tr");
    const typeKey = (t.tra_type || "").toUpperCase();
    const typeObj = TYPE_MAP[typeKey] || { text: "UNKNOWN", class: "badge-unknown" };

    tr.innerHTML = `
      <td><strong>${t.tra_no || '-'}</strong></td>
      <td class="text-center">
        <span class="badge ${typeObj.class}">${typeObj.text}</span>
      </td>
      <td class="text-capitalize">${t.tra_item_type || "-"}</td>
      <td>${t.item_name || "-"}</td>
      <td class="text-right font-weight-bold">${Number(t.tra_qty || 0).toLocaleString()}</td>
      <td class="text-muted small">${t.tra_note || "-"}</td>
      <td>${t.tra_created_at ? new Date(t.tra_created_at).toLocaleString('th-TH') : "-"}</td>
      <td class="text-center">
        ${canEdit ? `<button class="btn-icon edit-btn" data-id="${t.tra_id}" title="แก้ไข">✏️</button>` : "-"}
      </td>
      <td class="text-center">
        ${canDelete ? `<button class="btn-icon delete-btn" data-id="${t.tra_id}" title="ลบ">🗑️</button>` : "-"}
      </td>
    `;
    fragment.appendChild(tr);
  });

  if (transactions.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="9" class="text-center">ไม่พบรายการความเคลื่อนไหว</td>`;
    tbody.appendChild(emptyRow);
  } else {
    tbody.appendChild(fragment);
  }

  bindActionButtons();
}

/* ====================== BIND BUTTONS ====================== */
function bindActionButtons() {
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.onclick = () => window.location.href = `transactions-edit.html?id=${btn.dataset.id}`;
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = () => deleteTransaction(btn.dataset.id, btn);
  });
}

/* ====================== FILTER LOGIC ====================== */
function applyFilters() {
  const keyword = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const selectedType = document.getElementById("typeFilter")?.value || "";

  const filtered = allTransactions.filter(t => {
    const matchKeyword = 
      String(t.tra_no || "").toLowerCase().includes(keyword) ||
      String(t.item_name || "").toLowerCase().includes(keyword) ||
      String(t.tra_item_type || "").toLowerCase().includes(keyword);

    const matchType = !selectedType || (t.tra_type || "").toUpperCase() === selectedType;

    return matchKeyword && matchType;
  });

  renderTable(filtered);
}

/* ====================== DELETE ACTION ====================== */
async function deleteTransaction(id, btn) {
  if (!confirm("⚠️ คำเตือน: การลบรายการจะส่งผลต่อยอดสต็อกคงเหลือ คุณแน่ใจใช่หรือไม่?")) return;

  try {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = "...";

    const res = await fetch(`/transactions/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (res.ok) {
      alert("ลบรายการเรียบร้อยแล้ว ✅");
      btn.closest("tr").style.opacity = "0.3"; // แสดงสถานะว่าถูกลบแล้วก่อนหายไป
      setTimeout(() => btn.closest("tr").remove(), 300);
    } else {
      const result = await res.json();
      alert(result.message || "ลบไม่สำเร็จ");
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
  }
}

function setupTypeDropdown() {
  const select = document.getElementById("typeFilter");
  if (!select) return;
  let options = `<option value="">-- All Types --</option>`;
  Object.entries(TYPE_MAP).forEach(([key, value]) => {
    options += `<option value="${key}">${value.text}</option>`;
  });
  select.innerHTML = options;
  select.onchange = applyFilters;
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (input) {
    input.oninput = applyFilters; // ค้นหาแบบ Real-time
  }
}