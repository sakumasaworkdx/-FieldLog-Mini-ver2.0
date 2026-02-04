const $ = (id) => document.getElementById(id);
let db, currentGeo = null, currentFile = null, currentHeading = null;

const req = indexedDB.open("offline_survey_pwa_db", 2);
req.onsuccess = (e) => { db = e.target.result; renderTable(); };

// 方位取得
function updateHeading(e) {
    let h = e.webkitCompassHeading || (360 - e.alpha);
    if (h !== undefined) {
        currentHeading = Math.round(h);
        $("heading").textContent = `${currentHeading}°`;
    }
}

$("btnGeo").onclick = async () => {
    $("geoCheck").textContent = "⌛";
    navigator.geolocation.getCurrentPosition(
        (p) => { currentGeo = p; $("lat").textContent = p.coords.latitude.toFixed(6); $("lng").textContent = p.coords.longitude.toFixed(6); $("geoCheck").textContent = "✅"; },
        () => { $("geoCheck").textContent = "❌"; },
        { enableHighAccuracy: true }
    );
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') window.addEventListener("deviceorientation", updateHeading, true);
    } else {
        window.addEventListener("deviceorientationabsolute", updateHeading, true);
    }
};

$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if (currentFile) $("photoCheck").textContent = "✅";
};

$("btnSave").onclick = () => {
    const id = Date.now();
    const rec = {
        id: id,
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        heading: currentHeading || 0,
        location: $("selLocation").value,
        photoBlob: currentFile || new Blob([]),
        photoName: `img_${id}.jpg`
    };
    const tx = db.transaction("surveys", "readwrite");
    tx.objectStore("surveys").put(rec).onsuccess = () => {
        alert("保存完了");
        renderTable();
    };
};

function renderTable() {
    db.transaction("surveys", "readonly").objectStore("surveys").getAll().onsuccess = (e) => {
        const list = $("list"); list.innerHTML = "";
        e.target.result.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${r.location}</td><td>${r.photoBlob.size>0?"◯":"-"}</td><td>${r.lat!==0?"◯":"-"}</td>`;
            list.appendChild(tr);
        });
    };
}

$("btnDownloadAll").onclick = async () => {
    db.transaction("surveys", "readonly").objectStore("surveys").getAll().onsuccess = async (e) => {
        const data = e.target.result;
        const zip = new JSZip();
        let csv = "ID,緯度,経度,方位,地点\n";
        for (const r of data) {
            csv += `${r.id},${r.lat},${r.lng},${r.heading},${r.location}\n`;
            if (r.photoBlob.size > 0) zip.file(r.photoName, r.photoBlob);
        }
        zip.file("data.csv", "\ufeff" + csv);
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "data.zip"; a.click();
    };
};
