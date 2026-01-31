const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null;

const req = indexedDB.open("offline_survey_pwa_db", 2);
req.onsuccess = (e) => { db = e.target.result; renderTable(); loadLists(); };

// GPS
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

// 【修正】写真選択とプレビュー表示
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

// CSV読み込み (A:地点, B:小区分, C:項目)
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
    const tx = db.transaction("lists", "readonly");
    tx.objectStore("lists").getAll().onsuccess = (e) => {
        const data = e.target.result;
        $("selLocation").innerHTML = '<option value="">地点を選択</option>';
        $("selSubLocation").innerHTML = '<option value="">小区分を選択</option>';
        $("selItem").innerHTML = '<option value="">項目を選択</option>';

        // 重複を除去してリストに追加
        [...new Set(data.map(d => d.loc))].filter(v=>v).forEach(v => $("selLocation").innerHTML += `<option value="${v}">${v}</option>`);
        [...new Set(data.map(d => d.sub))].filter(v=>v).forEach(v => $("selSubLocation").innerHTML += `<option value="${v}">${v}</option>`);
        [...new Set(data.map(d => d.item))].filter(v=>v).forEach(v => $("selItem").innerHTML += `<option value="${v}">${v}</option>`);
    };
}

// 保存
$("btnSaveFinal").onclick = async () => {
    if (!currentFile && !confirm("写真なしで保存しますか？")) return;

    const id = Date.now();
    const rec = {
        id: id,
        createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        location: $("selLocation").value || "(未設定)",
        subLocation: $("selSubLocation").value || "",
        item: $("selItem").value || "",
        memo: $("memo").value,
        photoName: currentFile ? `img_${id}.jpg` : "no_image.jpg",
        photoBlob: currentFile || new Blob([])
    };

    const tx = db.transaction("surveys", "readwrite");
    tx.objectStore("surveys").put(rec).onsuccess = () => {
        alert("保存完了！");
        location.reload(); 
    };
};

async function renderTable() {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const listEl = $("list");
        listEl.innerHTML = "";
        e.target.result.sort((a,b) => b.id - a.id).forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${new Date(r.createdAt).toLocaleTimeString()}</td><td>${r.location}</td><td>${r.photoBlob.size>0?"◯":"-"}</td><td>${r.lat!==0?"◯":"-"}</td>`;
            listEl.appendChild(tr);
        });
    };
}
