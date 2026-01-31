const DB_NAME = "offline_survey_pwa_db";
const STORE_NAME = "surveys";
const LIST_STORE = "lists";
const $ = (id) => document.getElementById(id);

let db;
let currentGeo = null;
let currentFile = null;

// 起動時にデータベースを準備
const request = indexedDB.open(DB_NAME, 2);
request.onupgradeneeded = (e) => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME, { keyPath: "id" });
    if (!d.objectStoreNames.contains(LIST_STORE)) d.createObjectStore(LIST_STORE, { keyPath: "id" });
};
request.onsuccess = (e) => {
    db = e.target.result;
    renderTable(); // 表を表示
    loadLists();   // リストを表示
};

// GPS取得ボタン
$("btnGeo").onclick = () => {
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            $("geoWarn").style.display = "none";
        },
        (err) => {
            alert("GPSが取得できませんでしたが、保存は可能です。");
            $("geoWarn").style.display = "block";
        }
    );
};

// 写真選択
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if (currentFile) {
        $("preview").src = URL.createObjectURL(currentFile);
        $("preview").style.display = "block";
    }
};

// 保存ボタン
$("btnSave").onclick = async () => {
    const loc = $("selLocation").value;
    
    // GPSや写真がなくても確認を出して保存
    if (!currentFile || !currentGeo || !loc) {
        if (!confirm("写真・GPS・地点のいずれかが不足しています。このまま保存しますか？")) return;
    }

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

    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(rec);
    tx.oncomplete = () => {
        alert("保存完了しました");
        location.reload(); // 確実に反映させるため再読み込み
    };
};

// リスト読み込み
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
    alert("リストを更新しました");
    loadLists();
};

async function loadLists() {
    const tx = db.transaction(LIST_STORE, "readonly");
    tx.objectStore(LIST_STORE).getAll().onsuccess = (e) => {
        const all = e.target.result;
        $("selLocation").innerHTML = '<option value="">地点を選択</option>';
        $("selItem").innerHTML = '<option value="">項目を選択</option>';
        const locs = [...new Set(all.map(i => i.location).filter(v => v))];
        const items = [...new Set(all.map(i => i.item).filter(v => v))];
        locs.forEach(l => $("selLocation").innerHTML += `<option value="${l}">${l}</option>`);
        items.forEach(i => $("selItem").innerHTML += `<option value="${i}">${i}</option>`);
    };
}

async function renderTable() {
    const tx = db.transaction(STORE_NAME, "readonly");
    tx.objectStore(STORE_NAME).getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        e.target.result.reverse().slice(0, 10).forEach(r => {
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid #333";
            tr.innerHTML = `
                <td style="padding:8px; font-size:11px;">${new Date(r.createdAt).toLocaleTimeString()}</td>
                <td style="font-size:12px;">${r.location}</td>
                <td>${r.photoBlob.size > 0 ? "◯" : "❌"}</td>
                <td>${r.lat !== 0 ? "◯" : "❌"}</td>
            `;
            listEl.appendChild(tr);
        });
    };
}
