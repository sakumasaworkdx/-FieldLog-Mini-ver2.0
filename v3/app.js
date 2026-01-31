const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null;

const req = indexedDB.open("offline_survey_pwa_db", 2);
req.onsuccess = (e) => { db = e.target.result; renderTable(); loadLists(); };

// GPS取得
$("btnGeo").onclick = () => {
    const check = $("geoCheck");
    check.textContent = "⌛"; // 取得中
    
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            check.textContent = "✅";
        },
        (err) => {
            check.textContent = "❌";
            alert("GPSエラー: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

// 写真選択
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if(currentFile) $("photoCheck").textContent = "✅";
};

// 保存
$("btnSave").onclick = async () => {
    const loc = $("selLocation").value;
    if (!currentFile && !confirm("写真なしで保存しますか？")) return;

    const id = Date.now();
    const rec = {
        id: id,
        createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        location: loc || "(未設定)",
        item: $("selItem").value || "",
        memo: $("memo").value,
        photoName: currentFile ? `img_${id}.jpg` : "no_image.jpg",
        photoBlob: currentFile || new Blob([])
    };

    const tx = db.transaction("surveys", "readwrite");
    tx.objectStore("surveys").put(rec);
    tx.oncomplete = () => {
        alert("保存しました");
        location.reload(); 
    };
};

// リスト読み込み
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).slice(1);
    const tx = db.transaction("lists", "readwrite");
    const store = tx.objectStore("lists");
    await store.clear();
    for (const row of rows) {
        const [l, i] = row.split(",");
        if (l || i) store.put({ id: Math.random(), location: l?.trim(), item: i?.trim() });
    }
    alert("リスト更新完了");
    loadLists();
};

async function loadLists() {
    const tx = db.transaction("lists", "readonly");
    tx.objectStore("lists").getAll().onsuccess = (e) => {
        const all = e.target.result;
        $("selLocation").innerHTML = '<option value="">地点を選択</option>';
        $("selItem").innerHTML = '<option value="">項目を選択</option>';
        [...new Set(all.map(i => i.location))].filter(v=>v).forEach(l => $("selLocation").innerHTML += `<option value="${l}">${l}</option>`);
        [...new Set(all.map(i => i.item))].filter(v=>v).forEach(i => $("selItem").innerHTML += `<option value="${i}">${i}</option>`);
    };
}

async function renderTable() {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        e.target.result.reverse().slice(0, 10).forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${new Date(r.createdAt).toLocaleTimeString()}</td><td>${r.location}</td><td>${r.photoBlob.size>0?"◯":"-"}</td><td>${r.lat!==0?"◯":"-"}</td>`;
            listEl.appendChild(tr);
        });
    };
}
