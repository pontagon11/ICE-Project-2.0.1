const API_STOCK = "/stock";
const API_PURCHASE = "/purchase";
const API_QC = "/qc";

let stockData = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    //  โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // GUARD PAGE: เช็กสิทธิ์การมองเห็นสต็อก
    if (typeof hasPermission === "function") {
        if (!hasPermission("view_stock")) {
            alert("❌ คุณไม่มีสิทธิ์เข้าถึงระบบจัดการสต็อก");
            window.location.href = "home.html";
            return;
        }
    }

    // เริ่มต้นโหลดข้อมูลสต็อก
    loadStock();

    // ผูก Event ค้นหา
    document.getElementById("searchInput")?.addEventListener("input", searchStock);
    document.getElementById("typeFilter")?.addEventListener("change", searchStock);
});

/* ====================== LOAD CURRENT STOCK ====================== */
async function loadStock() {
    try {
        // เซ็ตหัวตารางสำหรับโหมด Stock
        const thead = document.querySelector("thead");
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>ID</th>
                    <th>Item Name</th>
                    <th>Type</th>
                    <th>Stock Qty</th>
                    <th>Status</th>
                    <th class="text-center">QC Check</th>
                </tr>
            `;
        }

        const res = await fetch(API_STOCK, { credentials: "include" });
        const data = await res.json();
        stockData = data;
        renderStockTable(data);

    } catch (err) {
        console.error("Load stock error:", err);
    }
}

/* ====================== RENDER STOCK TABLE ====================== */
function renderStockTable(data) {
    const tableBody = document.getElementById("stockTable");
    if (!tableBody) return;

    let html = "";
    data.forEach(item => {
        const typeClass = item.type === "product" ? "badge-product" : "badge-material";
        
        html += `
            <tr>
                <td>${item.id}</td>
                <td><strong>${item.name || "-"}</strong></td>
                <td><span class="badge ${typeClass}">${item.type}</span></td>
                <td class="text-right">${Number(item.stock).toLocaleString()}</td>
                <td>-</td>
                <td class="text-center">
                    <input type="checkbox" ${item.qc_status ? "checked" : ""} disabled>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html || '<tr><td colspan="6" class="text-center">ไม่พบข้อมูลในสต็อก</td></tr>';
}

/* ====================== SEARCH & FILTER ====================== */
function searchStock() {
    const keyword = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
    const typeFilter = document.getElementById("typeFilter")?.value.toLowerCase() || "all";

    const filtered = stockData.filter(item => {
        const matchName = (item.name || "").toLowerCase().includes(keyword);
        const itemType = (item.type || "").toLowerCase();
        const matchType = (typeFilter === "all") || (itemType === typeFilter);
        return matchName && matchType;
    });

    renderStockTable(filtered);
}

/* ====================== LOAD APPROVED PO (RECEIVE MODE) ====================== */
async function loadApprovedPO() {
    // เช็กสิทธิ์ก่อนเปลี่ยนโหมด
    if (typeof hasPermission === "function" && !hasPermission("receive_purchase")) {
        alert("คุณไม่มีสิทธิ์ดำเนินการรับของเข้าสต็อก");
        return;
    }

    try {
        const res = await fetch(`${API_PURCHASE}?status=approved`, { credentials: "include" });
        const data = await res.json();

        // เปลี่ยนหัวตารางเป็นโหมด Receive
        const thead = document.querySelector("thead");
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>PO Number</th>
                    <th>Material Name</th>
                    <th>Type</th>
                    <th class="text-right">Qty</th>
                    <th class="text-center">Action</th>
                </tr>
            `;
        }

        renderApprovedTable(data);
    } catch (err) {
        console.error("Load Approved PO Error:", err);
    }
}

function renderApprovedTable(data) {
    const tableBody = document.getElementById("stockTable");
    if (!tableBody) return;

    let html = "";
    let lastPO = null;

    data.forEach(p => {
        const isNewPO = p.po_id !== lastPO;
        html += `
            <tr>
                <td>${isNewPO ? `<strong>${p.po_no}</strong>` : ""}</td>
                <td>${p.mat_name}</td>
                <td>Material</td>
                <td class="text-right">${Number(p.qty).toLocaleString()}</td>
                <td class="text-center">
                    ${isNewPO ? `
                        <button class="btn-receive" onclick="receivePO(${p.po_id}, this)">
                            Receive Into Stock
                        </button>
                    ` : ""}
                </td>
            </tr>
        `;
        lastPO = p.po_id;
    });

    tableBody.innerHTML = html || '<tr><td colspan="5" class="text-center">ไม่มีรายการรอรับเข้า</td></tr>';
}

/* ====================== EXECUTE RECEIVE ====================== */
async function receivePO(id, btn) {
    if (!confirm("ยืนยันการรับสินค้า/วัสดุเข้าสต็อก?")) return;

    try {
        btn.disabled = true;
        btn.innerText = "Processing...";

        const res = await fetch(`${API_PURCHASE}/receive/${id}`, {
            method: "PUT",
            credentials: "include"
        });

        if (res.ok) {
            alert("อัปเดตสต็อกเรียบร้อยแล้ว! ✅");
            loadApprovedPO(); // โหลดรายการรอรับที่เหลือ
        } else {
            const result = await res.json();
            alert(result.message || "Receive failed");
            btn.disabled = false;
            btn.innerText = "Receive";
        }
    } catch (err) {
        console.error("Receive Error:", err);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        btn.disabled = false;
        btn.innerText = "Receive";
    }
}