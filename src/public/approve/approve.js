const API_APPROVE = "/approve";

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    
    // 1. รอให้ checkLogin ทำงานจนจบและดึง User ข้อมูลมาให้ (สำคัญมาก!)
    let user = null;
    if (typeof checkLogin === "function") {
        user = await checkLogin(); // รอจนกว่าข้อมูลจะถูกเซฟลง LocalStorage
    }

    // 2. วาด Sidebar
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // 3. GUARD PAGE: เช็คสิทธิ์
    // ตรวจสอบว่าข้อมูลใน LocalStorage มาหรือยัง
    const permissions = JSON.parse(localStorage.getItem("permissions") || "[]");
    console.log("✅ Permissions in LocalStorage:", permissions);
    console.log("🔍 Looking for: 'approve_po'");

    if (!permissions.includes("approve_po")) { 
        const errorMsg = `❌ ข้อผิดพลาดด้านสิทธิ์:\nคุณไม่มีสิทธิ์ 'approve_po'
\nสิทธิ์ที่มี: ${permissions.length > 0 ? permissions.join(', ') : '(ไม่มีสิทธิ์ใดๆ)'}
\nโปรดติดต่อผู้ดูแลระบบ`;
        
        console.error("❌ Permission Error:", errorMsg);
        await swalError("คุณไม่มีสิทธิ์ 'approve_po' โปรดติดต่อผู้ดูแลระบบ");
        window.location.href = "/home/home.html";
        return;
    }

    // 4. ถ้าผ่านสิทธิ์ ให้โหลดรายการ
    console.log("✅ สิทธิ์ตรวจสอบโอเค โหลดข้อมูลการอนุมัติ...");
    loadApproveList();

    // 5. ผูก Event Filter
    document.getElementById("statusFilter")?.addEventListener("change", loadApproveList);
});

/* ====================== LOAD PENDING PO ====================== */
async function loadApproveList() {
    const tableBody = document.getElementById("approveTable");
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center">⌛ Loading pending approvals...</td></tr>`;

    try {
        // ใช้ backtick (`) แทนฟันหนู เพื่อให้ตัวแปร ${API_APPROVE} ทำงาน
        const res = await fetch(`${API_APPROVE}/pending`, { credentials: "include" });
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

        html += `
            <tr>
                <td><strong>${p.po_no}</strong></td>
                <td>${p.requester_name || "-"}</td> 
                <td>
                    <span class="status-pending">⌛ ${p.status}</span>
                </td>
                <td>
                    <button class="btn-approve" onclick="handleApprove(${p.po_id}, this)">
                        Approve
                    </button>
                    <button class="btn-reject" onclick="handleReject(${p.po_id}, this)" style="background-color: #ff4d4d; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; margin-left: 5px;">
                        Reject
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html || `<tr><td colspan="4" class="text-center">ไม่มีรายการรออนุมัติในขณะนี้</td></tr>`;
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