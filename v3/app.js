const APP_VERSION = "v3.0";
const $ = (id) => document.getElementById(id);

// データベース設定 (v2と共通の名前にしてデータを引き継ぐ)
const DB_NAME = "offline_survey_pwa_db";
const STORE_NAME = "surveys";
const LIST_STORE = "lists";

let db;
let currentGeo = null;
let currentFile = null;
let currentTs = null;

// --- 初期化 ---
async function init() {
    db = await initDB();
    updateCount();
    renderTable(); // 表の描画
    loadLists();   // プルダウンの読み込み
}

function initDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME, { keyPath: "id" });
            if (!d.objectStoreNames.contains(LIST_STORE)) d.createObjectStore(LIST_STORE, { keyPath: "id" });
        };
        req.onsuccess = (e) => resolve(e.target.result);
    });
}

// --- GPS取得 ---
$("btnGeo").onclick = () => {
    navigator.geolocation.getCurrentPosition(
        (p) => {
            currentGeo = p;
            $("lat").textContent = p.coords.latitude.toFixed(6);
            $("lng").textContent = p.coords.longitude.toFixed(6);
            $("geoWarn").style.display = "none";
        },
        (err) => {
            alert("GPS取得失敗: " + err.message);
            $("geoWarn").style.display = "inline";
        },
        { enableHighAccuracy: true }
    );
};

// --- 保存処理 (ご要望③: GPSなしでも許可) ---
$("btnSave").onclick = async () => {
    const loc = $("selLocation").value;
    
    // 写真やGPSがなくても警告だけで止まらないようにする
    if (!currentFile || !currentGeo || !loc) {
        if (!confirm("写真、GPS、または地点が未入力です。このまま保存しますか？")) return;
    }

    const ts = currentTs || new Date();
    const id = Date.now();
    const photoName = currentFile ? `img_${id}.jpg` : "no_image.jpg";

    const rec = {
        id: id,
        createdAt: ts.toISOString(),
        lat: currentGeo ? currentGeo.coords.latitude : 0,
        lng: currentGeo ? currentGeo.coords.longitude : 0,
        acc: currentGeo ? currentGeo.coords.accuracy : 0,
        location: loc || "(未設定)",
        location2: $("selLocation2").value || "",
        item: $("selItem").value || "",
        memo: $("memo").value,
        memo2: $("memo2").value,
        photoName: photoName,
        photoBlob: currentFile || new Blob([])
    };

    const tx = db.transaction(STORE_NAME, "readwrite");
    await tx.objectStore(STORE_NAME).put(rec);
    alert("保存完了");
    
    // リセット
    currentFile = null;
    $("preview").src = "";
    updateCount();
    renderTable();
};

// --- 一覧表の描画 (ご要望②: 撮り忘れチェック) ---
async function renderTable() {
    const tx = db.transaction(STORE_NAME, "readonly");
    const all = await new Promise(res => {
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => res(req.result);
    });

    const listEl = $("list");
    listEl.innerHTML = "";
    
    all.reverse().slice(0, 10).forEach(r => {
        const tr = document.createElement("tr");
        const hasPhoto = r.photoBlob && r.photoBlob.size > 0;
        const hasGeo = r.lat !== 0;
        
        tr.innerHTML = `
            <td>${new Date(r.createdAt).toLocaleTimeString()}</td>
            <td>${r.location}</td>
            <td style="color:${hasPhoto ? '#00ff00':'#ff4444'}">${hasPhoto ? '◯':'❌'}</td>
            <td style="color:${hasGeo ? '#00ff00':'#ff4444'}">${hasGeo ? '◯':'❌'}</td>
        `;
        listEl.appendChild(tr);
    });
}

// 簡易的な件数更新
async function updateCount() {
    const tx = db.transaction(STORE_NAME, "readonly");
    const countReq = tx.objectStore(STORE_NAME).count();
    countReq.onsuccess = () => $("count").textContent = countReq.result;
}

// 初期化実行
init();
