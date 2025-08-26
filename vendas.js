// Módulo de vendas: registrar e listar vendas
export async function salvarVenda(venda) {
  let salvo = false;
  if (window.idb && window.openDB) {
    if (!window.db) window.db = await window.openDB();
    if (!window.idb) window.idb = idb;
    try {
      await window.idb.set('sales', venda);
      salvo = true;
    } catch (e) {
      console.error('Erro ao salvar venda no IndexedDB:', e);
    }
  }
  if (!salvo) {
    let vendas = [];
    try { vendas = JSON.parse(localStorage.getItem('sales')||'[]'); } catch { vendas = []; }
    vendas.push(venda);
    localStorage.setItem('sales', JSON.stringify(vendas));
  }
}

export async function listarVendas() {
  if (window.idb && window.openDB) {
    if (!window.db) window.db = await window.openDB();
    if (!window.idb) window.idb = idb;
    return await window.idb.all('sales');
  } else {
    try { return JSON.parse(localStorage.getItem('sales')||'[]'); } catch { return []; }
  }
}
