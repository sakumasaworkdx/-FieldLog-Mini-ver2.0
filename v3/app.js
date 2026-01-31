const DB_NAME = "offline_survey_pwa_db";
const STORE_NAME = "surveys";
const LIST_STORE = "lists";
const $ = (id) => document.getElementById(id);

let db;
let currentGeo = null;
let currentFile = null;

// --- 起動時の処理 ---
async function init() {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME, { keyPath: "id" });
        if (!d.objectStoreNames.contains(LIST_STORE)) d.createObjectStore(LIST_STORE, { keyPath: "id" });
    };
    req.onsuccess = (e) => {
        db = e.target.result;
        renderTable();
        loadLists();
    };
}

// --- GPSボタン ---
$("btnGeo").onclick = () => {
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            $("geoWarn").style.display = "none";
        },
        (err) => {
            alert("GPSが取得できませんでしたが、このまま保存は可能です。");
            $("geoWarn").style.display = "block";
        }
    );
};

// --- 写真選択 ---
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if (currentFile) $("preview").src = URL.createObjectURL(currentFile);
};

// --- 保存ボタン ---
$("btnSave").onclick = async () => {
    const loc = $("selLocation").value;
    
    // 警告を出すが、キャンセルしなければ保存を続行する
    if (!currentFile || !currentGeo || !loc) {
        if (!confirm("写真、GPS、または地点が未入力です。このまま保存しますか？")) return;
    }

    const id = Date.now();
    const rec = {
        id: id,
        createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        location: loc || "(未設定)",
        location2: $("selLocation2").value || "",
        item: $("selItem").value || "",
        memo: $("memo").value,
        memo2: $("memo2").value,
        photoName: currentFile ? `img_${id}.jpg` : "no_image.jpg",
        photoBlob: currentFile || new Blob([])
    };

    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(rec);
    alert("保存しました");
    
    // 入力をリセット
    $("preview").src = "";
    currentFile = null;
    renderTable();
};

// --- CSVリスト読み込み ---
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).slice(1);
    const tx = db.transaction(LIST_STORE, "readwrite");
    const store = tx.objectStore(LIST_STORE);
    await store.clear();
    for (const row of rows) {
        const [l, i] = row.split(",");
        if (l || i) store.put({ id: Math.random(), location: l?.trim(), item: i?.trim() });
    }
    alert("リストを読み込みました");
    loadLists();
};

async function loadLists() {
    const tx = db.transaction(LIST_STORE, "readonly");
    const all = await new Promise(res => {
        const req = tx.objectStore(LIST_STORE).getAll();
        req.onsuccess = () => res(req.result);
    });
    $("selLocation").innerHTML = '<option value="">地点を選択</option>';
    $("selItem").innerHTML = '<option value="">項目を選択</option>';
    const locs = [...new Set(all.map(i => i.location).filter(v => v))];
    const items = [...new Set(all.map(i => i.item).filter(v => v))];
    locs.forEach(l => $("selLocation").innerHTML += `<option value="${l}">${l}</option>`);
    items.forEach(i => $("selItem").innerHTML += `<option value="${i}">${i}</option>`);
}

// --- テーブル描画 ---
async function renderTable() {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
        const listEl = $("list");
        listEl.innerHTML = "";
        req.result.reverse().slice(0, 10).forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
                <td>${r.location}</td>
                <td>${r.photoBlob.size > 0 ? "◯" : "❌"}</td>
                <td>${r.lat !== 0 ? "◯" : "❌"}</td>
            `;
            listEl.appendChild(tr);
        });
    };
}

init();
