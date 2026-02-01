const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null;

// IndexedDB接続
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
        (err) => { 
            $("geoCheck").textContent = "❌"; 
            console.warn("GPS取得スキップ:", err.message); 
        },
        { enableHighAccuracy: true, timeout: 7000 }
    );
};

// 写真選択・プレビュー表示
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if(currentFile) {
        $("photoCheck").textContent = "✅";
        const reader = new FileReader();
        reader.onload = (re) => {
            $("imgPreview").src = re.target.result;
            $("previewContainer").style.display = "block";
            $("previewLabel").textContent = "新規撮影(保存前)";
        };
        reader.readAsDataURL(currentFile);
    }
};

// CSV読み込み (A:地点, B:小区分, C:項目)
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const rows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r !== "");
        const tx = db.transaction("lists", "readwrite");
        const store = tx.objectStore("lists");
        await store.clear();

        rows.forEach((row, idx) => {
            const cols = row.split(",").map(c => c.replace(/^["']|["']$/g, '').trim());
            if (cols.length >= 1) {
                store.put({ id: idx, loc: cols[0] || "", sub: cols[1] || "", item: cols[2] || "" });
            }
        });
        tx.oncomplete = () => { alert("リストを更新しました。"); loadLists(); };
    } catch (err) {
        alert("読み込み失敗。");
    }
};

async function loadLists() {
    if (!db) return;
    const tx = db.transaction("lists", "readonly");
    tx.objectStore("lists").getAll().onsuccess = (e) => {
        const data = e.target.result;
        const updateSelect = (id, values, defaultText) => {
            const el = $(id);
            el.innerHTML = `<option value="">${defaultText}</option>`;
            const headers = ["地点", "小区分", "項目", "loc", "sub", "item"];
            const uniqueValues = [...new Set(values)].filter(v => v && !headers.includes(v.toLowerCase()));
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
    const hasData = currentFile || $("memo").value.trim() !== "" || $("selLocation").value !== "";
    if (!hasData) { alert("保存するデータがありません。"); return; }

    const id = Date.now();
    const rec = {
        id: id,
        createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        location: $("selLocation").value || "-",
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

// 履歴表示 ＆ 写真再表示
async function renderTable() {
    if (!db) return;
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        e.target.result.sort((a,b) => b.id - a.id).forEach(r => {
            const tr = document.createElement("tr");
            tr.style.fontSize = "11px";
            tr.innerHTML = `
                <td style="text-align:left;">${r.location}</td>
                <td style="text-align:left;">${r.subLocation}</td>
                <td style="text-align:left;">${r.item}</td>
                <td class="photo-cell" style="cursor:pointer; color:#00bb55; font-weight:bold; font-size:16px;">${r.photoBlob.size > 0 ? "◯" : "-"}</td>
                <td>${r.lat !== 0 ? "◯" : "-"}</td>
            `;
            if (r.photoBlob.size > 0) {
                tr.querySelector(".photo-cell").onclick = () => {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        $("imgPreview").src = re.target.result;
                        $("previewContainer").style.display = "block";
                        $("previewLabel").innerHTML = `【履歴表示】${r.location}<br>備考: ${r.memo || ""}`;
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    };
                    reader.readAsDataURL(r.photoBlob);
                };
            }
            listEl.appendChild(tr);
        });
    };
}

// 📦 一括ダウンロード (CSV + 写真)
$("btnDownloadAll").onclick = async () => {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = async (e) => {
        const data = e.target.result;
        if (!data || data.length === 0) { alert("データがありません"); return; }

        const zip = new JSZip();
        let csv = "ID,日時,緯度,経度,地点,小区分,項目,備考,写真名\n";

        for (const r of data) {
            csv += `${r.id},${r.createdAt},${r.lat},${r.lng},${r.location},${r.subLocation},${r.item},"${(r.memo || "").replace(/"/g, '""')}",${r.photoName}\n`;
            if (r.photoBlob && r.photoBlob.size > 0) {
                zip.file(r.photoName, r.photoBlob); // ZIP直下に写真を配置
            }
        }

        zip.file("data_list.csv", "\ufeff" + csv);
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `survey_export_${Date.now()}.zip`;
        link.click();
    };
};
