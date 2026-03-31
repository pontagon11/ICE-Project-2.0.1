/* ============================================================
   SWEETALERT2 HELPERS  –  ใช้แทน alert() / confirm() / prompt()
   ต้องโหลด SweetAlert2 CDN ก่อน script นี้
   ============================================================ */

function swalSuccess(msg, then) {
  return Swal.fire({
    icon: "success",
    title: "สำเร็จ",
    text: msg,
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
    customClass: { popup: "swal-custom" }
  }).then(() => { if (typeof then === "function") then(); });
}

function swalError(msg) {
  return Swal.fire({
    icon: "error",
    title: "เกิดข้อผิดพลาด",
    text: msg,
    confirmButtonColor: "#1a237e",
    customClass: { popup: "swal-custom" }
  });
}

function swalWarning(msg) {
  return Swal.fire({
    icon: "warning",
    title: "คำเตือน",
    text: msg,
    confirmButtonColor: "#f0ad4e",
    customClass: { popup: "swal-custom" }
  });
}

function swalInfo(msg) {
  return Swal.fire({
    icon: "info",
    title: "แจ้งเตือน",
    text: msg,
    confirmButtonColor: "#1a237e",
    customClass: { popup: "swal-custom" }
  });
}

function swalConfirm(msg, title) {
  return Swal.fire({
    icon: "question",
    title: title || "ยืนยันการดำเนินการ",
    text: msg,
    showCancelButton: true,
    confirmButtonText: "ยืนยัน",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1a237e",
    cancelButtonColor: "#d33",
    customClass: { popup: "swal-custom" }
  });
}

function swalInput(title, placeholder) {
  return Swal.fire({
    title: title,
    input: "textarea",
    inputPlaceholder: placeholder || "กรอกข้อความที่นี่...",
    showCancelButton: true,
    confirmButtonText: "ตกลง",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1a237e",
    cancelButtonColor: "#d33",
    inputValidator: (value) => { if (!value) return "กรุณากรอกข้อมูล"; },
    customClass: { popup: "swal-custom" }
  });
}
