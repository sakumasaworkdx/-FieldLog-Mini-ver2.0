const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null;

// IndexedDBの初期化
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
$("btnGeo").onclick = () => {
    $("geoCheck").textContent = "⌛";
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            $("geoCheck").textContent = "✅";
        },
        (err) => { $("geoCheck").textContent = "❌"; alert("GPS失敗"); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

// 写真選択・プレビュー
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if(currentFile) {
        $("photoCheck").textContent = "✅";
        const reader = new FileReader();
        reader.onload = (re) => {
            $("imgPreview").src = re.target.result;
            $("previewContainer").style.display = "block";
        };
        reader.readAsDataURL(currentFile);
    }
};

// 【重要】CSV読み込み処理
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    // 改行コードに関わらず分割し、空行を除去。1行目（ヘッダ）を飛ばす
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== "").slice(1);
    
    const tx = db.transaction("lists", "readwrite");
    const store = tx.objectStore("lists");
    await store.clear();

    rows.forEach((row, idx) => {
        const cols = row.split(",");
        store.put({ 
            id: idx, 
            loc: cols[0]?.trim() || "", 
            sub: cols[1]?.trim() || "", 
            item: cols[2]?.trim() || "" 
        });
    });

    tx.oncomplete = () => { 
        alert(rows.length + "件のリストを更新しました。"); 
        loadLists(); // 読み込み完了後にプルダウンを更新
    };
};

// プルダウンの生成
async function loadLists() {
    if (!db) return;
    const tx = db.transaction("lists", "readonly");
    const store = tx.objectStore("lists");
    store.getAll().onsuccess = (e) => {
        const data = e.target.result;
        
        const updateSelect = (id, values, defaultText) => {
            const el = $(id);
            el.innerHTML = `<option value="">${defaultText}</option>`;
            const uniqueValues = [...new Set(values)].filter(v => v);
            uniqueValues.forEach(v => {
                const opt = document.createElement("option");
                opt.value = v; opt.textContent = v;
                el.appendChild(opt);
            });
        };

        updateSelect("selLocation", data.map(d => d.loc), "地点を選択");
        updateSelect("selSubLocation", data.map(d => d.sub), "小区分を選択");
        updateSelect("selItem", data.map(d => d.item), "項目を選択");
    };
}

// 保存
$("btnSave").onclick = async () => {
    if (!$("selLocation").value) { alert("地点を選択してください"); return; }
    if (!currentFile && !confirm("写真なしで保存しますか？")) return;

    const id = Date.now();
    const rec = {
        id: id,
        createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        location: $("selLocation").value,
        subLocation: $("selSubLocation").value || "-",
        item: $("selItem").value || "-",
        memo: $("memo").value,
        photoName: currentFile ? `img_${id}.jpg` : "no_image.jpg",
        photoBlob: currentFile || new Blob([])
    };

    const tx = db.transaction("surveys", "readwrite");
    tx.objectStore("surveys").put(rec).onsuccess = () => {
        alert("保存完了");
        // リセット
        currentFile = null;
        $("previewContainer").style.display = "none";
        $("photoCheck").textContent = "";
        $("memo").value = "";
        renderTable(); 
    };
};

// 履歴テーブル表示
async function renderTable() {
    if (!db) return;
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        const sorted = e.target.result.sort((a,b) => b.id - a.id);
        sorted.forEach(r => {
            const tr = document.createElement("tr");
            tr.style.fontSize = "11px";
            tr.innerHTML = `
                <td style="text-align:left;">${r.location}</td>
                <td style="text-align:left;">${r.subLocation}</td>
                <td style="text-align:left;">${r.item}</td>
                <td>${r.photoBlob.size > 0 ? "◯" : "-"}</td>
                <td>${r.lat !== 0 ? "◯" : "-"}</td>
            `;
            listEl.appendChild(tr);
        });
    };
}
