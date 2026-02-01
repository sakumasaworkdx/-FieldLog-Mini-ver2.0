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
        $("previewLabel").textContent = "新規撮影(保存前)";
        const reader = new FileReader();
        reader.onload = (re) => {
            $("imgPreview").src = re.target.result;
            $("previewContainer").style.display = "block";
        };
        reader.readAsDataURL(currentFile);
    }
};

// CSV読み込み
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
        store.put({ id: idx, loc: cols[0]?.trim(), sub: cols[1]?.trim(), item: cols[2]?.trim() });
    });
    tx.oncomplete = () => { alert("リスト更新完了"); loadLists(); };
};

async function loadLists() {
    if (!db) return;
    const tx = db.transaction("lists", "readonly");
    tx.objectStore("lists").getAll().onsuccess = (e) => {
        const data = e.target.result;
        const updateSelect = (id, values, defaultText) => {
            const el = $(id);
            el.innerHTML = `<option value="">${defaultText}</option>`;
            [...new Set(values)].filter(v => v).forEach(v => {
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
        currentFile = null;
        $("previewContainer").style.display = "none";
        $("photoCheck").textContent = "";
        $("memo").value = "";
        renderTable(); 
    };
};

// 履歴テーブル表示 ＆ 写真表示機能
async function renderTable() {
    if (!db) return;
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        const data = e.target.result.sort((a,b) => b.id - a.id);
        
        data.forEach(r => {
            const tr = document.createElement("tr");
            tr.style.fontSize = "11px";
            
            // ◯ の部分に id を持たせるか、直接 onclick を埋め込む
            const photoStatus = r.photoBlob && r.photoBlob.size > 0 ? "◯" : "-";
            const geoStatus = r.lat !== 0 ? "◯" : "-";

            tr.innerHTML = `
                <td style="text-align:left;">${r.location}</td>
                <td style="text-align:left;">${r.subLocation}</td>
                <td style="text-align:left;">${r.item}</td>
                <td class="photo-cell" style="cursor:pointer; color:#00bb55; font-weight:bold; font-size:16px;">${photoStatus}</td>
                <td>${geoStatus}</td>
            `;

            // 写真がある場合のみクリックイベントを設定
            if (r.photoBlob && r.photoBlob.size > 0) {
                const cell = tr.querySelector(".photo-cell");
                cell.onclick = (event) => {
                    event.preventDefault(); // 連打や誤動作防止
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        $("imgPreview").src = re.target.result;
                        $("previewContainer").style.display = "block";
                        $("previewLabel").innerHTML = `【過去データ表示】<br>${r.location} / ${r.subLocation}<br>備考: ${r.memo || "なし"}`;
                        // スムーズに上へ移動
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    };
                    reader.readAsDataURL(r.photoBlob);
                };
            }
            listEl.appendChild(tr);
        });
    };
}

// 一括ダウンロード (ZIP)
$("btnDownloadAll").onclick = async () => {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = async (e) => {
        const data = e.target.result;
        if (data.length === 0) { alert("データがありません"); return; }
        const zip = new JSZip();
        let csv = "ID,日時,緯度,経度,地点,小区分,項目,備考,写真名\n";
        data.forEach(r => {
            csv += `${r.id},${r.createdAt},${r.lat},${r.lng},${r.location},${r.subLocation},${r.item},"${(r.memo || "").replace(/"/g, '""')}",${r.photoName}\n`;
            if (r.photoBlob.size > 0) zip.file(r.photoName, r.photoBlob);
        });
        zip.file("data_list.csv", "\ufeff" + csv);
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `survey_v3_data_${Date.now()}.zip`;
        link.click();
    };
};
