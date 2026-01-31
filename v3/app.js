const APP_VERSION = "v3.0";
const $ = (id) => document.getElementById(id);

// データベース名は共通（v2のデータも見えるように）
const DB_NAME = "offline_survey_pwa_db";
const STORE_NAME = "surveys";

let db;
let currentGeo = null;
let currentFile = null;

// 初期化
async function init() {
    const req = indexedDB.open(DB_NAME, 2);
    req.onsuccess = (e) => {
        db = e.target.result;
        renderTable(); 
    };
}

// GPS取得（ご要望③: 失敗しても保存は許可する）
$("btnGeo").onclick = () => {
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            $("geoWarn").style.display = "none";
        },
        (err) => {
            alert("GPSが取得できませんでした。");
            $("geoWarn").style.display = "block";
        }
    );
};

// 写真選択
$("photoInput").onchange = (e) => {
    currentFile = e.target.files[0];
    if(currentFile) $("preview").src = URL.createObjectURL(currentFile);
};

// 保存処理（アップロードしていただいたロジックを採用）
$("btnSave").onclick = async () => {
    let warnings = [];
    if (!currentFile) warnings.push("写真がありません");
    if (!currentGeo) warnings.push("GPS情報がありません");
    const loc = $("selLocation").value;
    if (!loc) warnings.push("地点が未選択です");

    if (warnings.length > 0) {
        if (!confirm(warnings.join("\n") + "\n\nこのまま保存しますか？")) return;
    }

    const rec = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        location: loc || "(未設定)",
        memo: $("memo").value,
        photoName: currentFile ? `img_${Date.now()}.jpg` : "no_image.jpg",
        photoBlob: currentFile || new Blob([])
    };

    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(rec);
    alert("保存しました");
    renderTable();
};

// 一覧表示（ご要望②: 撮り忘れチェック）
async function renderTable() {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
        const listEl = $("list");
        listEl.innerHTML = "";
        req.result.reverse().slice(0, 10).forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
                <td>${r.location}</td>
                <td>${r.photoBlob.size > 0 ? "◯" : "❌"}</td>
                <td>${r.lat !== 0 ? "◯" : "❌"}</td>
            `;
            listEl.appendChild(tr);
        });
    };
}

init();
