const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null, currentHeading = null, currentDirName = "-";
let map = null, markersLayer = null;
let basePos = [35.6812, 139.7671]; // デフォルト（東京駅）

const req = indexedDB.open("offline_survey_pwa_db", 2);
req.onupgradeneeded = (e) => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains("surveys")) d.createObjectStore("surveys", { keyPath: "id" });
    if (!d.objectStoreNames.contains("lists")) d.createObjectStore("lists", { keyPath: "id" });
};
req.onsuccess = (e) => { db = e.target.result; renderTable(); loadLists(); };

function getDirectionName(deg) {
    if (deg === null || deg === undefined) return "-";
    const directions = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];
    return directions[Math.round(deg / 22.5) % 16];
}

function updateHeading(e) {
    let h = e.webkitCompassHeading || (360 - e.alpha);
    if (h !== undefined) {
        currentHeading = Math.round(h);
        currentDirName = getDirectionName(currentHeading);
        $("heading").textContent = `${currentHeading}° (${currentDirName})`;
    }
}

function updateMapData(data) {
    if (typeof L === 'undefined') return;
    if (!map) {
        map = L.map('map').setView(basePos, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
        markersLayer = L.layerGroup().addTo(map);
    }
    markersLayer.clearLayers();
    const bounds = [];
    data.forEach(r => {
        if (r.lat && r.lat !== 0) {
            const pos = [r.lat, r.lng];
            bounds.push(pos);
            const arrowHtml = `<div style="transform: rotate(${r.heading}deg); font-size: 20px; color: #ff3333; text-shadow: 1px 1px 2px #000;">↑</div>`;
            L.marker(pos, {icon: L.divIcon({html: arrowHtml, className: 'map-arrow', iconSize: [20, 20], iconAnchor: [10, 10]})})
             .addTo(markersLayer).bindPopup(`<b>${r.location}</b><br>${r.headingName}(${r.heading}°)`);
        }
    });
}

// 地図操作ボタン
$("btnZoomFit").onclick = () => {
    if (!db) return;
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = (e) => {
        const bounds = e.target.result.filter(r => r.lat !== 0).map(r => [r.lat, r.lng]);
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [20, 20] });
        else alert("データがありません");
    };
};
$("btnJumpBase").onclick = () => { if (map) map.setView(basePos, 16); };

$("btnGeo").onclick = async () => {
    $("geoCheck").textContent = "⌛";
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            $("geoCheck").textContent = "✅";
            if (map && !currentFile) map.panTo([p.coords.latitude, p.coords.longitude]); // GPS取得時に地図を移動
        },
        () => { $("geoCheck").textContent = "❌"; },
        { enableHighAccuracy: true, timeout: 7000 }
    );
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try { if (await DeviceOrientationEvent.requestPermission() === 'granted') window.addEventListener("deviceorientation", updateHeading, true); } catch (e) {}
    } else { window.addEventListener("deviceorientationabsolute", updateHeading, true) || window.addEventListener("deviceorientation", updateHeading, true); }
};

$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if(currentFile) {
        $("photoCheck").textContent = "✅";
        const reader = new FileReader();
        reader.onload = (re) => { $("imgPreview").src = re.target.result; $("previewContainer").style.display = "block"; };
        reader.readAsDataURL(currentFile);
    }
};

$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r !== "");
    const tx = db.transaction("lists", "readwrite");
    const store = tx.objectStore("lists");
    await store.clear();
    rows.forEach((row, idx) => {
        const cols = row.split(",").map(c => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length >= 1) store.put({ id: idx, loc: cols[0] || "", sub: cols[1] || "", item: cols[2] || "" });
    });
    tx.oncomplete = () => { alert("リスト更新完了"); loadLists(); };
};

async function loadLists() {
    if (!db) return;
    db.transaction("lists", "readonly").objectStore("lists").getAll().onsuccess = (e) => {
        const data = e.target.result;
        const updateSelect = (id, values, label) => {
            const el = $(id);
            el.innerHTML = `<option value="">${label}</option>`;
            [...new Set(values)].filter(v => v && !["地点","小区分","項目"].includes(v)).forEach(v => {
                const opt = document.createElement("option"); opt.value = opt.textContent = v; el.appendChild(opt);
            });
        };
        updateSelect("selLocation", data.map(d => d.loc), "地点を選択");
        updateSelect("selSubLocation", data.map(d => d.sub), "小区分を選択");
        updateSelect("selItem", data.map(d => d.item), "項目を選択");
    };
}

$("btnSave").onclick = async () => {
    if (!currentFile && $("memo").value.trim() === "" && $("selLocation").value === "") return;
    const id = Date.now();
    const rec = {
        id: id, createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        heading: currentHeading || 0, headingName: currentDirName || "-",
        location: $("selLocation").value || "-", subLocation: $("selSubLocation").value || "-", item: $("selItem").value || "-",
        memo: $("memo").value, photoName: currentFile ? `img_${id}.jpg` : "no_image.jpg", photoBlob: currentFile || new Blob([])
    };
    db.transaction("surveys", "readwrite").objectStore("surveys").put(rec).onsuccess = () => {
        alert("保存完了");
        currentFile = null; $("previewContainer").style.display = "none"; $("photoCheck").textContent = ""; $("memo").value = "";
        renderTable(); 
    };
};

async function renderTable() {
    if (!db) return;
    db.transaction("surveys", "readonly").objectStore("surveys").getAll().onsuccess = (e) => {
        const data = e.target.result;
        const listEl = $("list");
        listEl.innerHTML = "";
        data.sort((a,b) => b.id - a.id).forEach(r => {
            const tr = document.createElement("tr");
            tr.style.fontSize = "11px";
            tr.innerHTML = `<td style="text-align:left;">${r.location}</td><td style="text-align:left;">${r.subLocation}</td><td style="text-align:left;">${r.item}</td><td class="photo-cell" style="cursor:pointer; color:#00bb55; font-weight:bold; font-size:16px;">${r.photoBlob.size > 0 ? "◯" : "-"}</td><td>${r.lat !== 0 ? "◯" : "-"}</td>`;
            if (r.photoBlob.size > 0) {
                tr.querySelector(".photo-cell").onclick = () => {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        $("imgPreview").src = re.target.result; $("previewContainer").style.display = "block";
                        $("previewLabel").innerHTML = `【履歴】${r.location}<br>方位: ${r.headingName}(${r.heading}°)<br>${r.memo || ""}`;
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    };
                    reader.readAsDataURL(r.photoBlob);
                };
            }
            listEl.appendChild(tr);
        });
        updateMapData(data);
    };
}

$("btnDeleteAll").onclick = async () => {
    if (confirm("履歴をすべて削除しますか？") && prompt("確認のため「さくじょ」と入力") === "さくじょ") {
        db.transaction("surveys", "readwrite").objectStore("surveys").clear().onsuccess = () => renderTable();
    }
};

$("btnDownloadAll").onclick = async () => {
    const tx = db.transaction("surveys", "readonly");
    tx.objectStore("surveys").getAll().onsuccess = async (e) => {
        const data = e.target.result;
        if (!data.length) return;
        const zip = new JSZip();
        let csv = "ID,日時,緯度,経度,方位,方位名,地点,小区分,項目,備考,写真名\n";
        for (const r of data) {
            csv += `${r.id},${r.createdAt},${r.lat},${r.lng},${r.heading},${r.headingName},${r.location},${r.subLocation},${r.item},"${(r.memo || "").replace(/"/g, '""')}",${r.photoName}\n`;
            if (r.photoBlob.size > 0) zip.file(r.photoName, await r.photoBlob.arrayBuffer());
        }
        zip.file("data_list.csv", "\ufeff" + csv);
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `survey_data_${Date.now()}.zip`;
        link.click();
    };
};
