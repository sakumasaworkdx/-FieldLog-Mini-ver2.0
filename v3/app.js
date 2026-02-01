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
        (err) => { 
            $("geoCheck").textContent = "❌"; 
            console.log("GPS利用不可（スキップ可）"); 
        },
        { enableHighAccuracy: true, timeout: 5000 }
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
            $("previewLabel").textContent = "新規撮影(保存前)";
        };
        reader.readAsDataURL(currentFile);
    }
};

// CSV読み込み (エラー耐性を強化)
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        // 行分割し、空行を除去。ヘッダの有無に関わらず処理
        const rows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r !== "");
        
        // 1行目が「地点」などの漢字を含む場合はヘッダとして飛ばす
        const startIdx = (rows[0].includes("地点") || rows[0].includes("loc")) ? 1 : 0;
        const dataRows = rows.slice(startIdx);

        const tx = db.transaction("lists", "readwrite");
        const store = tx.objectStore("lists");
        await store.clear();

        dataRows.forEach((row, idx) => {
            const cols = row.split(",");
            store.put({ 
                id: idx, 
                loc: cols[0]?.replace(/"/g, '') || "", 
                sub: cols[1]?.replace(/"/g, '') || "", 
                item: cols[2]?.replace(/"/g, '') || "" 
            });
        });

        tx.oncomplete = () => { 
            alert(dataRows.length + "件のリストを読み込みました"); 
            loadLists(); 
        };
    } catch (err) {
        alert("CSVの形式が正しくない可能性があります: " + err.message);
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

// 保存 (入力チェックを最小限に)
$("btnSave").onclick = async () => {
    // 地点・GPS・写真・メモ、いずれも「必須」とはせず、何かしらアクションがあれば保存可能にする
    const hasData = currentFile || $("memo").value.trim() !== "" || $("selLocation").value !== "";
    
    if (!hasData) {
        alert("保存するデータ（写真、地点、またはメモ）がありません。");
        return;
    }

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
    const store = tx.objectStore("surveys");
    store.put(rec).onsuccess = () => {
        alert("保存完了");
        // リセット
        currentFile = null;
        currentGeo = null;
        $("previewContainer").style.display = "none";
        $("photoCheck").textContent = "";
        $("geoCheck").textContent = "";
        $("lat").textContent = "-";
        $("lng").textContent = "-";
        $("memo").value = "";
        renderTable(); 
    };
};

// 履歴テーブル
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
                <td class="photo-cell" style="cursor:pointer; color:#00bb55; font-weight:bold; font-size:16px;">${r.photoBlob.size > 0 ? "◯" : "-"}</td>
                <td>${r.lat !== 0 ? "◯" : "-"}</td>
            `;
            if (r.photoBlob.size > 0) {
                tr.querySelector(".photo-cell").onclick = () => {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        $("imgPreview").src = re.target.result;
                        $("previewContainer").style.display = "block";
                        $("previewLabel").innerHTML = `【過去表示】${r.location}<br>備考: ${r.memo || ""}`;
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    };
                    reader.readAsDataURL(r.photoBlob);
                };
            }
            listEl.appendChild(tr);
        });
    };
}

// 一括DL
$("btnDownloadAll").onclick = async () => {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = async (e) => {
        const data = e.target.result;
        if (data.length === 0) return;
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
        link.download = `survey_data.zip`;
        link.click();
    };
};
