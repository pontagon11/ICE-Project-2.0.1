const API_QC = "/qc";
let qcData = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
  // 1. โหลดข้อมูล User และวาด Sidebar
  if (typeof loadUser === "function") {
    await loadUser();
  }
  
  if (typeof renderSidebar === "function") {
    renderSidebar();
  }

  // 2. GUARD PAGE: เช็กสิทธิ์การมองเห็นหน้า QC
  if (typeof hasPermission === "function") {
    if (!hasPermission("view_qc")) {
      await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้ารายงาน QC");
      window.location.href = "/home/home.html";
      return;
    }

    // 3. เช็กสิทธิ์ปุ่มสร้าง QC
    if (!hasPermission("create_qc")) {
      const addBtn = document.getElementById("addBtn");
      if (addBtn) addBtn.style.display = "none";
    }
  }

  // 4. โหลดข้อมูลและตั้งค่า Event
  await loadQC();

  document.getElementById("searchBtn")?.addEventListener("click", applyFilters);
  document.getElementById("typeFilter")?.addEventListener("change", applyFilters);
  
  // ค้นหาอัตโนมัติขณะพิมพ์
  document.getElementById("searchInput")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") applyFilters();
  });

  document.getElementById("addBtn")?.addEventListener("click", () => {
    window.location.href = "/qc/qc-add.html";
  });
});

/* ====================== LOAD QC DATA ====================== */
async function loadQC() {
  try {
    const res = await fetch(API_QC, { credentials: "include" });
    const data = await res.json();
    qcData = data;
    renderTable(qcData);
  } catch (err) {
    console.error("QC load error", err);
  }
}

/* ====================== RENDER TABLE ====================== */
function renderTable(data) {
  const tableBody = document.getElementById("qcTable");
  if (!tableBody) return;

  let html = "";
  // เช็กว่า User มีสิทธิ์กดอนุมัติ QC หรือไม่
  const canApprove = typeof hasPermission === "function" && hasPermission("approve_qc");

  data.forEach(item => {
    const statusClass = item.qc_status === "pass" ? "status-pass" : 
                        item.qc_status === "fail" ? "status-fail" : "status-wait";
    
    const statusText = item.qc_status === "pass" ? "✔ PASS" : 
                       item.qc_status === "fail" ? "❌ FAIL" : "⌛ WAIT";

    html += `
      <tr>
        <td><strong>${item.qc_no || '-'}</strong></td>
        <td>${item.name || '-'}</td>
        <td class="text-capitalize">${item.item_type}</td>
        <td>
          <span class="badge ${statusClass}">${statusText}</span>
        </td>
        <td>${formatDate(item.qc_date)}</td>
        <td class="text-center">
          ${(item.qc_status === "wait" && canApprove) ? `
            <button class="btn-pass" onclick="handleQC(${item.qc_id}, 'pass')">PASS</button>
            <button class="btn-fail" onclick="handleQC(${item.qc_id}, 'fail')">FAIL</button>
          ` : (item.qc_status !== "wait" ? "-" : "No Permission")}
        </td>
        <td>${item.emp_name || "-"}</td>
      </tr>
    `;
  });

  tableBody.innerHTML = html || '<tr><td colspan="7" class="text-center">ไม่พบข้อมูลการตรวจสอบ</td></tr>';
}

/* ====================== FILTER ====================== */
function applyFilters() {
  const keyword = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const type = document.getElementById("typeFilter")?.value || "all";

  const filtered = qcData.filter(item => {
    const matchName = (item.name || "").toLowerCase().includes(keyword) || 
                      (item.qc_no || "").toLowerCase().includes(keyword);
    const matchType = type === "all" || item.item_type === type;
    return matchName && matchType;
  });

  renderTable(filtered);
}

/* ====================== QC ACTION ====================== */
async function handleQC(id, result) {
  const actionText = result === 'pass' ? "ยืนยันผล PASS ใช่หรือไม่?" : "ยืนยันผล FAIL ใช่หรือไม่?";
  const { isConfirmed } = await swalConfirm(actionText, "ยืนยันผล QC");
  if (!isConfirmed) return;

  try {
    const url = result === 'pass' ? `/qc/pass/${id}` : `/qc/fail/${id}`;
    const res = await fetch(url, {
      method: "PUT",
      credentials: "include"
    });

    if (res.ok) {
      await swalSuccess(`บันทึกผล ${result.toUpperCase()} สำเร็จ`);
      loadQC();
    } else {
      const data = await res.json();
      await swalError(data.message || "การบันทึกผลล้มเหลว");
    }
  } catch (err) {
    console.error(`QC ${result} error:`, err);
    await swalError("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
  }
}

/* ====================== DATE FORMAT ====================== */
function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}