const API_PURCHASE = "/purchase";
let allPurchases = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const user = await window.checkLogin();
        if (!user) return;

        if (!hasPermission("view_purchase")) {
            await swalError("You do not have permission to view purchase orders.");
            window.location.href = "/home/home.html";
            return;
        }

        await loadPurchase();
        initSearch();
    } catch (err) {
        console.error("Initialization Error:", err);
    }
});

/* ====================== SEARCH SYSTEM ====================== */
function initSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    const performSearch = () => {
        const term = (searchInput?.value || "").toLowerCase().trim();
        const filtered = allPurchases.filter((p) => {
            return (
                (p.po_no && p.po_no.toLowerCase().includes(term)) ||
                (p.emp_name && p.emp_name.toLowerCase().includes(term)) ||
                (p.status && p.status.toLowerCase().includes(term))
            );
        });
        renderTable(filtered);
    };

    searchInput?.addEventListener("input", performSearch);
    searchBtn?.addEventListener("click", performSearch);
}

/* ====================== LOAD & RENDER TABLE ====================== */
async function loadPurchase() {
    try {
        const res = await fetch(API_PURCHASE, { credentials: "include" });
        const data = await res.json();

        if (!Array.isArray(data)) {
            const tableBody = document.getElementById("purchaseTable");
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${data.message || "Failed to load data"}</td></tr>`;
            }
            return;
        }

        // Group one row per PO for concise list view
        const poMap = new Map();
        data.forEach((row) => {
            if (!poMap.has(row.po_id)) {
                poMap.set(row.po_id, {
                    po_id: row.po_id,
                    po_no: row.po_no,
                    emp_name: row.emp_name || "-",
                    po_date: row.po_date,
                    status: row.status || "PENDING"
                });
            }
        });

        allPurchases = Array.from(poMap.values());
        renderTable(allPurchases);
    } catch (err) {
        console.error("Load purchase error:", err);
    }
}

function renderTable(dataToRender) {
    const tableBody = document.getElementById("purchaseTable");
    if (!tableBody) return;

    let html = "";

    dataToRender.forEach((p) => {
        const statusClean = (p.status || "pending").toLowerCase();
        const canReceive = hasPermission("edit_purchase") && statusClean !== "received";

        html += `
            <tr>
                <td><strong>${p.po_no || "-"}</strong></td>
                <td>${p.emp_name || "-"}</td>
                <td>${p.po_date ? new Date(p.po_date).toLocaleDateString("th-TH") : "-"}</td>
                <td><span class="status-badge status-${statusClean}">${statusClean.toUpperCase()}</span></td>
                <td class="text-center">
                    ${canReceive ? `<button class="btn-receive" onclick="receivePO(${p.po_id}, this)">Receive</button>` : ""}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html || '<tr><td colspan="5" class="text-center">No purchase orders found</td></tr>';
}

/* ====================== RECEIVE ACTION ====================== */
async function receivePO(id, btn) {
    const { isConfirmed } = await swalConfirm("Confirm receiving this purchase order?");
    if (!isConfirmed) return;

    try {
        btn.disabled = true;
        btn.innerText = "Saving...";

        const res = await fetch(`${API_PURCHASE}/receive/${id}`, {
            method: "PUT",
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("Purchase order received successfully");
            await loadPurchase();
        } else {
            const result = await res.json();
            await swalError(result.message || "Receive failed");
            btn.disabled = false;
            btn.innerText = "Receive";
        }
    } catch (err) {
        await swalError("Connection error");
        btn.disabled = false;
        btn.innerText = "Receive";
    }
}

// Go to add page
const addBtn = document.getElementById("addBtn");
if (addBtn) {
    addBtn.addEventListener("click", () => {
        window.location.href = "/purchase/purchase-add.html";
    });
}
