/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof hasPermission === "function" && !hasPermission("view_purchase")) {
        await swalError("คุณไม่มีสิทธิ์ดูรายละเอียดใบสั่งซื้อ");
        window.location.href = "/purchase/purchase.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const poId = params.get("id");

    if (!poId) {
        document.getElementById("poDetails").innerHTML =
            `<p class="text-center text-muted">ไม่พบ PO ID — <a href="/purchase/purchase.html">กลับไปหน้ารายการ</a></p>`;
        return;
    }

    await loadPODetail(poId);
});

/* ====================== LOAD PO DETAIL ====================== */
async function loadPODetail(poId) {
    const container = document.getElementById("poDetails");
    try {
        const res = await fetch(`/purchase/${poId}`, { credentials: "include" });
        if (!res.ok) {
            const err = await res.json();
            container.innerHTML = `<p class="text-center text-danger">${err.message || "โหลดข้อมูลไม่สำเร็จ"}</p>`;
            return;
        }

        const rows = await res.json();
        if (!rows.length) {
            container.innerHTML = `<p class="text-center text-muted">ไม่พบข้อมูล</p>`;
            return;
        }

        const head = rows[0];
        const statusClean = (head.status || "pending").toLowerCase();
        const canReceive = typeof hasPermission === "function" && hasPermission("edit_purchase") && statusClean !== "received";

        let itemsHtml = rows.map(r => `
            <tr>
                <td>${r.mat_no || "-"}</td>
                <td>${r.mat_name}</td>
                <td class="text-right">${Number(r.qty).toLocaleString()}</td>
            </tr>
        `).join("");

        container.innerHTML = `
            <div class="po-header">
                <div class="po-meta">
                    <div><span class="label">PO No</span><strong>${head.po_no}</strong></div>
                    <div><span class="label">Requester</span>${head.emp_name || "-"}</div>
                    <div><span class="label">Date</span>${head.po_date ? new Date(head.po_date).toLocaleDateString("th-TH") : "-"}</div>
                    <div><span class="label">Status</span><span class="status-badge status-${statusClean}">${statusClean.toUpperCase()}</span></div>
                    ${head.tra_note ? `<div><span class="label">Note</span>${head.tra_note}</div>` : ""}
                </div>
            </div>
            <table class="po-items-table">
                <thead><tr><th>Code</th><th>Material</th><th class="text-right">Qty</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="po-footer">
                ${canReceive ? `<button class="btn-receive" onclick="receivePO(${head.po_id})"><i class="fa fa-check"></i> Receive PO</button>` : ""}
                <button class="btn-secondary" onclick="window.location.href='/purchase/purchase.html'"><i class="fa fa-arrow-left"></i> Back</button>
            </div>
        `;
    } catch (err) {
        console.error("Load PO detail error:", err);
        container.innerHTML = `<p class="text-center text-danger">เกิดข้อผิดพลาดจากเซิร์ฟเวอร์</p>`;
    }
}

/* ====================== RECEIVE ACTION ====================== */
async function receivePO(id) {
    const { isConfirmed } = await swalConfirm("ยืนยันการรับสินค้าเข้าคลังใช่หรือไม่?", "รับสินค้า");
    if (!isConfirmed) return;

    try {
        const res = await fetch(`/purchase/receive/${id}`, {
            method: "PUT",
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("รับสินค้าเข้าคลังเรียบร้อยแล้ว");
            loadPODetail(id);
        } else {
            const data = await res.json();
            await swalError(data.message || "เกิดข้อผิดพลาด");
        }
    } catch (err) {
        console.error("Receive PO error:", err);
        await swalError("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
    }
}
