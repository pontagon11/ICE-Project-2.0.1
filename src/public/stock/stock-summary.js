let stockData = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
  // โหลดข้อมูล User และวาด Sidebar
  if (typeof loadUser === "function") {
    await loadUser();
  }
  
  if (typeof renderSidebar === "function") {
    renderSidebar();
  }

  // GUARD PAGE: เช็กสิทธิ์การดู Stock Summary
  if (typeof hasPermission === "function") {
    if (!hasPermission("view_stock_summary")) {
      await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้าสรุปสต็อก");
      window.location.href = "/home/home.html";
      return;
    }
  }

  // โหลดข้อมูล Stock จาก Server
  await loadStock();

  // ตั้งค่าการ Filter และ Search
  const typeFilter = document.getElementById("typeFilter");
  const searchInput = document.getElementById("searchInput");

  if (typeFilter) {
    typeFilter.addEventListener("change", renderTable);
  }

  if (searchInput) {
    // ใช้ input event เพื่อให้กรองข้อมูลทันทีที่พิมพ์ (Real-time)
    searchInput.addEventListener("input", renderTable);
    
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") renderTable();
    });
  }
});

/* ====================== LOAD STOCK ====================== */
async function loadStock() {
  try {
    const res = await fetch("/stock-summary", { credentials: "include" });
    const data = await res.json();

    stockData = data;
    renderTable();

  } catch (err) {
    console.error("Load stock error:", err);
    await swalError("ไม่สามารถโหลดข้อมูลสรุปสต็อคได้");
  }
}

/* ====================== RENDER TABLE ====================== */
function renderTable() {
  const tableBody = document.getElementById("stockTable");
  if (!tableBody) return;

  const typeFilterValue = document.getElementById("typeFilter")?.value.toLowerCase().trim() || "all";
  const searchValue = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";

  // 🔍 กรองข้อมูลตามเงื่อนไข
  const filteredData = stockData.filter(item => {
    const itemType = (item.tra_item_type || "").toLowerCase().trim();
    const itemName = (item.item_name || "").toLowerCase().trim();

    // เช็กประเภท (รองรับทั้งเอกพจน์/พหูพจน์)
    const matchType = (typeFilterValue === "all") || 
                      (itemType === typeFilterValue) || 
                      (itemType === typeFilterValue + "s") || 
                      (itemType + "s" === typeFilterValue);

    // เช็กชื่อสินค้าหรือวัสดุ
    const matchSearch = itemName.includes(searchValue);

    return matchType && matchSearch;
  });

  // วาดตารางข้อมูล
  let html = "";
  
  filteredData.forEach(item => {
    const totalIn = Number(item.total_in) || 0;
    const totalOut = Number(item.total_out) || 0;
    const balance = totalIn - totalOut;

    // เลือกสี Badge ตามประเภท
    const badgeClass = item.tra_item_type === "product" ? "badge-product" : "badge-material";

    html += `
      <tr>
        <td class="text-center">
          <span class="badge ${badgeClass}">
            ${item.tra_item_type.toUpperCase()}
          </span>
        </td>
        <td><strong>${item.item_name || "-"}</strong></td>
        <td class="text-right text-success">${totalIn.toLocaleString()}</td>
        <td class="text-right text-danger">${totalOut.toLocaleString()}</td>
        <td class="text-right font-weight-bold ${balance < 0 ? "text-negative" : ""}">
          ${balance.toLocaleString()}
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html || '<tr><td colspan="5" class="text-center">ไม่พบข้อมูลสต็อกที่ค้นหา</td></tr>';
}