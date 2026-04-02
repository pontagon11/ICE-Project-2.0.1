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
      await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้าประวัติรายการ");
      window.location.href = "/home/home.html";
      return;
    }
  }

  // เริ่มต้นโหลดข้อมูลและตั้งค่า UI
  loadTransactions();
  setupTypeDropdown();
  setupSearch();

  // ผูกปุ่มเพิ่มรายการ
  document.getElementById("addTransactionBtn")?.addEventListener("click", () => {
    window.location.href = "/transactions/transactions-add.html";
  });
});

/* ====================== FETCH DATA ====================== */
async function loadTransactions() {
  try {
    const tbody = document.getElementById("historyTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center">⌛ Loading Transactions...</td></tr>`;

    const res = await fetch("/transactions", { credentials: "include" });

    if (res.status === 401) {
      window.location.href = "/";
      return;
    }

    const result = await res.json();
    // รองรับทั้งโครงสร้าง { data: [] } หรือ []
    allTransactions = result.data || result || [];
    renderTable(allTransactions);

  } catch (err) {
    console.error("Load transactions error:", err);
    const tbody = document.getElementById("historyTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Failed to load data</td></tr>`;
  }
}

/* ====================== RENDER TABLE ====================== */
function renderTable(transactions) {
  const tbody = document.getElementById("historyTable");
  if (!tbody) return;

  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  const canEdit = typeof hasPermission === "function" && hasPermission("create_transactions");

  transactions.forEach((t) => {
    const tr = document.createElement("tr");
    const typeKey = (t.tra_type || "").toUpperCase();
    const typeObj = TYPE_MAP[typeKey] || { text: "UNKNOWN", class: "badge-unknown" };

    tr.innerHTML = `
      <td><strong>${t.tra_no || '-'}</strong></td>
      <td>${t.item_name || "-"}</td>
      <td class="text-capitalize">${t.tra_item_type || "-"}</td>
      <td class="text-center"><span class="badge ${typeObj.class}">${typeObj.text}</span></td>
      <td class="text-right">${Number(t.tra_qty || 0).toLocaleString()}</td>
      <td>${t.tra_created_at ? new Date(t.tra_created_at).toLocaleDateString('th-TH') : "-"}</td>
      <td>${t.tra_note || "-"}</td>
      <td class="text-center">
        ${canEdit ? `<button class="edit-btn" onclick="location.href='/transactions/transactions-edit.html?id=${t.tra_id}'" title="View Details"><i class="fa fa-eye"></i></button>` : "-"}
      </td>
    `;
    fragment.appendChild(tr);
  });

  if (transactions.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="8" class="text-center">ไม่พบรายการความเคลื่อนไหว</td>`;
    tbody.appendChild(emptyRow);
  } else {
    tbody.appendChild(fragment);
  }
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
  const { isConfirmed } = await swalConfirm("การลบรายการจะส่งผลต่อยอดสต็อคคงเหลือ คุณแน่ใจใช่หรือไม่?", "ยืนยันการลบ");
  if (!isConfirmed) return;

  try {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerText = "...";

    const res = await fetch(`/transactions/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (res.ok) {
      await swalSuccess("ลบรายการเรียบร้อยแล้ว");
      btn.closest("tr").style.opacity = "0.3";
      setTimeout(() => btn.closest("tr").remove(), 300);
    } else {
      const result = await res.json();
      await swalError(result.message || "ลบไม่สำเร็จ");
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  } catch (err) {
    console.error(err);
    await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
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