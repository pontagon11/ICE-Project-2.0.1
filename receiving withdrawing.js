const addBtn = document.getElementById('add-btn');
const tableBody = document.getElementById('data-body');

let editRow = null;

addBtn.addEventListener('click', () => {
    const date = document.getElementById('input-date').value;
    const receive = document.getElementById('input-receive').value;
    const receiveNote = document.getElementById('input-receive-note').value;
    const orderNumber = document.getElementById('input-order-number').value;
    const issue = document.getElementById('input-issue').value;
    const issueNote = document.getElementById('input-issue-note').value;

    if (!date || !receive || receiveNote === "SELECT" || orderNumber === "SELECT" || !issue || issueNote === "SELECT") {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    const data = [date, receive, receiveNote, orderNumber, issue, issueNote];

    if (editRow) {
        for (let i = 0; i < 6; i++) {
            editRow.cells[i].textContent = data[i];
        }
        editRow = null;
        addBtn.textContent = "ADD";
    } else {
        const tr = document.createElement('tr');
        data.forEach(d => {
            const td = document.createElement('td');
            td.textContent = d;
            tr.appendChild(td);
        });

        const editTd = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = "Edit";
        editBtn.onclick = () => {
            document.getElementById('input-date').value = tr.cells[0].textContent;
            document.getElementById('input-receive').value = tr.cells[1].textContent;
            document.getElementById('input-receive-note').value = tr.cells[2].textContent;
            document.getElementById('input-order-number').value = tr.cells[3].textContent;
            document.getElementById('input-issue').value = tr.cells[4].textContent;
            document.getElementById('input-issue-note').value = tr.cells[5].textContent;

            editRow = tr;
            addBtn.textContent = "UPDATE";
        };
        editTd.appendChild(editBtn);
        tr.appendChild(editTd);

        const deleteTd = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => {
            tableBody.removeChild(tr);
            if (editRow === tr) {
                editRow = null;
                addBtn.textContent = "ADD";
            }
        };
        deleteTd.appendChild(deleteBtn);
        tr.appendChild(deleteTd);

        tableBody.appendChild(tr);
    }

    document.getElementById('input-date').value = '';
    document.getElementById('input-receive').value = '';
    document.getElementById('input-receive-note').value = 'SELECT';
    document.getElementById('input-order-number').value = 'SELECT';
    document.getElementById('input-send').value = '';
    document.getElementById('input-issue').value = '';
    document.getElementById('input-issue-note').value = 'SELECT';
});