const API_APPROVE = "/approve";

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {

    // 1. Load user & draw sidebar
    if (typeof loadUser === "function") await loadUser();
    if (typeof renderSidebar === "function") renderSidebar();

    // 2. Guard: use shared hasPermission (supports admin bypass)
    if (!hasPermission("approve_po")) {
        await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้าอนุมัติการสั่งซื้อ");
        window.location.href = "/home/home.html";
        return;
    }

    loadApproveList();
    document.getElementById("statusFilter")?.addEventListener("change", loadApproveList);
});

/* ====================== LOAD PO LIST ====================== */
async function loadApproveList() {
    const tableBody = document.getElementById("approveTable");
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center">⌛ Loading...</td></tr>`;

    try {
        const statusFilter = document.getElementById("statusFilter")?.value || "pending";
        const res = await fetch(`${API_APPROVE}/pending?status=${statusFilter}`, { credentials: "include" });
        const data = await res.json();

        if (!res.ok) {
            await swalError(data.message || "ไม่สามารถโหลดข้อมูลได้");
            return;
        }

        renderTable(data);

    } catch (err) {
        console.error("Load error:", err);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error connecting to server</td></tr>`;
    }
}

/* ====================== RENDER TABLE ====================== */
function renderTable(data) {
    const tableBody = document.getElementById("approveTable");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const shownIds = new Set();
    let html = "";

    data.forEach(p => {
        if (shownIds.has(p.po_id)) return;
        shownIds.add(p.po_id);

        const statusClean = (p.status || '').toUpperCase();
        const statusClass = statusClean === 'PENDING' ? 'status-pending' :
                            statusClean === 'APPROVED' ? 'status-approved' :
                            statusClean === 'REJECTED' ? 'status-rejected' :
                            statusClean === 'RECEIVED' ? 'status-received' : '';

        const isPending = statusClean === 'PENDING';

        html += `
            <tr>
                <td><strong>${p.po_no}</strong></td>
                <td>${p.requester_name || "-"}</td> 
                <td>
                    <span class="${statusClass}">${statusClean}</span>
                </td>
                <td>
                    ${isPending ? `
                    <button class="btn-approve" onclick="handleApprove(${p.po_id}, this)">
                        Approve
                    </button>
                    <button class="btn-reject" onclick="handleReject(${p.po_id}, this)" style="background-color: #ff4d4d; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; margin-left: 5px;">
                        Reject
                    </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html || `<tr><td colspan="4" class="text-center">ไม่มีรายการในสถานะนี้</td></tr>`;
}

/* ====================== EXECUTE APPROVE ====================== */
async function handleApprove(id, btn) {
    const { isConfirmed } = await swalConfirm("คุณต้องการอนุมัติใบสั่งซื้อนี้ใช่หรือไม่?", "ยืนยันการอนุมัติ");
    if (!isConfirmed) return;

    try {
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "Processing...";

        const res = await fetch(`${API_APPROVE}/confirm/${id}`, {
            method: "PUT",
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("อนุมัติสำเร็จเรียบร้อยแล้ว");
            loadApproveList(); 
        } else {
            const result = await res.json();
            await swalError(result.message || "การอนุมัติล้มเหลว");
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (err) {
        console.error("Approve error:", err);
        await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        btn.disabled = false;
        btn.innerText = "Approve";
    }
}

/* ====================== EXECUTE REJECT ====================== */
async function handleReject(id, btn) {
    const { value: reason, isConfirmed: promptOk } = await swalInput("กรุณาระบุเหตุผลที่ปฏิเสธ", "ระบุเหตุผล...");
    if (!promptOk) return;

    try {
        btn.disabled = true;
        const res = await fetch(`${API_APPROVE}/reject/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason || "ถูกปฏิเสธโดยผู้อนุมัติ" }),
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("ปฏิเสธใบสั่งซื้อเรียบร้อยแล้ว");
            loadApproveList();
        } else {
            await swalError("ไม่สามารถดำเนินการได้");
            btn.disabled = false;
        }
    } catch (err) {
        console.error("Reject error:", err);
        btn.disabled = false;
    }
}