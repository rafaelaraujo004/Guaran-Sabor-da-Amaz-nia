// Módulo de produtos: cadastro, listagem e atualização de estoque
export async function salvarProduto(produto) {
  let salvo = false;
  if (window.idb && window.openDB) {
    if (!window.db) window.db = await window.openDB();
    if (!window.idb) window.idb = idb;
    try {
      await window.idb.set('products', produto);
      salvo = true;
    } catch (e) {
      console.error('Erro ao salvar produto no IndexedDB:', e);
    }
  }
  if (!salvo) {
    let produtos = [];
    try { produtos = JSON.parse(localStorage.getItem('products')||'[]'); } catch { produtos = []; }
    const idx = produtos.findIndex(p=>p.id===produto.id);
    if (idx>-1) produtos[idx] = produto;
    else produtos.push(produto);
    localStorage.setItem('products', JSON.stringify(produtos));
  }
}

export async function listarProdutos() {
  if (window.idb && window.openDB) {
    if (!window.db) window.db = await window.openDB();
    if (!window.idb) window.idb = idb;
    return await window.idb.all('products');
  } else {
    try { return JSON.parse(localStorage.getItem('products')||'[]'); } catch { return []; }
  }
}

export async function atualizarEstoqueProduto(sku, delta) {
  let produtos = await listarProdutos();
  const idx = produtos.findIndex(p => p.sku === sku);
  if (idx > -1) {
    produtos[idx].stock = Math.max(0, (produtos[idx].stock||0) + delta);
    await salvarProduto(produtos[idx]);
  }
}
