const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null;

// IndexedDB初期化
const req = indexedDB.open("offline_survey_pwa_db", 2);
req.onupgradeneeded = (e) => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains("surveys")) d.createObjectStore("surveys", { keyPath: "id" });
    if (!d.objectStoreNames.contains("lists")) d.createObjectStore("lists", { keyPath: "id" });
};
req.onsuccess = (e) => { 
    db = e.target.result; 
    renderTable(); 
    loadLists(); 
};

// GPS取得
$("btnGeo").onclick = (e) => {
    e.preventDefault();
    const check = $("geoCheck");
    check.textContent = "⌛";
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            check.textContent = "✅";
        },
        (err) => { check.textContent = "❌"; alert("GPSエラー: " + err.message); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

// 写真選択
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if(currentFile) $("photoCheck").textContent = "✅";
};

// 【重要】保存ボタン：確実にクリックを拾うように記述
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btnSave') {
        const loc = $("selLocation").value;
        const item = $("selItem").value;
        const memo = $("memo").value;

        if (!currentFile && !confirm("写真が選択されていません。保存しますか？")) return;

        const id = Date.now();
        const rec = {
            id: id,
            createdAt: new Date().toISOString(),
            lat: currentGeo ? currentGeo.coords.latitude : 0,
            lng: currentGeo ? currentGeo.coords.longitude : 0,
            location: loc || "(未設定)",
            item: item || "(未設定)",
            memo: memo || "",
            photoName: currentFile ? `img_${id}.jpg` : "no_image.jpg",
            photoBlob: currentFile || new Blob([])
        };

        const tx = db.transaction("surveys", "readwrite");
        const store = tx.objectStore("surveys");
        const addReq = store.put(rec);

        addReq.onsuccess = () => {
            alert("保存しました");
            location.reload(); 
        };
        addReq.onerror = () => alert("保存に失敗しました。");
    }
});

// CSV読み込み（カンマ区切りを正確に処理）
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== "");
    
    const tx = db.transaction("lists", "readwrite");
    const store = tx.objectStore("lists");
    await store.clear();

    // 2行目から処理 (1行目はヘッダ)
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",");
        const locVal = cols[0] ? cols[0].trim() : "";
        const itemVal = cols[1] ? cols[1].trim() : "";
        if (locVal || itemVal) {
            store.put({ id: i, location: locVal, item: itemVal });
        }
    }
    tx.oncomplete = () => {
        alert("リストを更新しました");
        loadLists();
    };
};

// リスト表示
async function loadLists() {
    const tx = db.transaction("lists", "readonly");
    tx.objectStore("lists").getAll().onsuccess = (e) => {
        const all = e.target.result;
        $("selLocation").innerHTML = '<option value="">地点を選択</option>';
        $("selItem").innerHTML = '<option value="">項目を選択</option>';
        const locs = [...new Set(all.map(i => i.location))].filter(v => v);
        const items = [...new Set(all.map(i => i.item))].filter(v => v);
        locs.forEach(l => $("selLocation").innerHTML += `<option value="${l}">${l}</option>`);
        items.forEach(i => $("selItem").innerHTML += `<option value="${i}">${i}</option>`);
    };
}

// 履歴表示（全件表示）
async function renderTable() {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        // 降順（新しい順）ですべて表示
        e.target.result.sort((a,b) => b.id - a.id).forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
                <td style="text-align:left;">${r.location}</td>
                <td>${r.photoBlob.size > 0 ? "◯" : "-"}</td>
                <td>${r.lat !== 0 ? "◯" : "-"}</td>
            `;
            listEl.appendChild(tr);
        });
    };
}

// 全削除
$("btnClear").onclick = () => {
    if(confirm("全データを削除しますか？")) {
        const tx = db.transaction("surveys", "readwrite");
        tx.objectStore("surveys").clear();
        tx.oncomplete = () => location.reload();
    }
};
