// --- CSVリスト読み込み機能 ---

// CSVを解析してデータベースに保存
$("listCsvInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = text.split(/\r?\n/).slice(1); // 1行目(ヘッダ)を飛ばす
    const lists = [];

    rows.forEach((row, idx) => {
        const [loc, item] = row.split(",");
        if (loc || item) {
            lists.push({ id: idx, location: loc?.trim() || "", item: item?.trim() || "" });
        }
    });

    const tx = db.transaction("lists", "readwrite");
    const store = tx.objectStore("lists");
    await store.clear();
    for (const item of lists) { store.put(item); }
    
    alert(`${lists.length}件のリストを読み込みました。`);
    loadLists(); // プルダウンを更新
};

// データベースからリストを読み込んでプルダウン(select)に反映
async function loadLists() {
    const tx = db.transaction("lists", "readonly");
    const store = tx.objectStore("lists");
    const all = await new Promise(res => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
    });

    // プルダウンを初期化
    $("selLocation").innerHTML = '<option value="">地点を選択</option>';
    $("selItem").innerHTML = '<option value="">項目を選択</option>';

    // 重複を排除して追加
    const locs = [...new Set(all.map(i => i.location).filter(v => v))];
    const items = [...new Set(all.map(i => i.item).filter(v => v))];

    locs.forEach(l => $("selLocation").innerHTML += `<option value="${l}">${l}</option>`);
    items.forEach(i => $("selItem").innerHTML += `<option value="${i}">${i}</option>`);
}

// リストの全削除ボタン
$("btnClearLists").onclick = async () => {
    if (!confirm("読み込んだリストを削除しますか？")) return;
    const tx = db.transaction("lists", "readwrite");
    await tx.objectStore("lists").clear();
    loadLists();
};
