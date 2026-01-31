const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null;

const req = indexedDB.open("offline_survey_pwa_db", 2);
req.onsuccess = (e) => { db = e.target.result; renderTable(); loadLists(); };

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

// 3列CSV読み込み
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
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
    tx.oncomplete = () => { alert("リスト更新完了"); loadLists(); };
};

async function loadLists() {
    if (!db) return;
    const tx = db.transaction("lists", "readonly");
    tx.objectStore("lists").getAll().onsuccess = (e) => {
        const data = e.target.result;
        const setOptions = (id, values, defaultText) => {
            const el = $(id);
            el.innerHTML = `<option value="">${defaultText}</option>`;
            [...new Set(values)].filter(v => v).forEach(v => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.textContent = v;
                el.appendChild(opt);
            });
        };
        setOptions("selLocation", data.map(d => d.loc), "地点を選択");
        setOptions("selSubLocation", data.map(d => d.sub), "小区分を選択");
        setOptions("selItem", data.map(d => d.item), "項目を選択");
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
        // リセット処理
        currentFile = null;
        $("previewContainer").style.display = "none";
        $("photoCheck").textContent = "";
        $("memo").value = "";
        renderTable(); 
    };
};

async function renderTable() {
    if (!db) return;
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        // 新しい順に並び替え
        e.target.result.sort((a,b) => b.id - a.id).forEach(r => {
            const tr = document.createElement("tr");
            tr.style.fontSize = "11px";
            tr.innerHTML = `
                <td style="text-align:left; word-break:break-all;">${r.location}</td>
                <td style="text-align:left; word-break:break-all;">${r.subLocation}</td>
                <td style="text-align:left; word-break:break-all;">${r.item}</td>
                <td>${r.photoBlob.size > 0 ? "◯" : "-"}</td>
                <td>${r.lat !== 0 ? "◯" : "-"}</td>
            `;
            listEl.appendChild(tr);
        });
    };
}
