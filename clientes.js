// Módulo de clientes para cadastro, listagem e manipulação
export async function salvarCliente(cliente) {
  let salvo = false;
  if (window.idb && window.openDB) {
    if (!window.db) window.db = await window.openDB();
    if (!window.idb) window.idb = idb;
    try {
      await window.idb.set('customers', cliente);
      salvo = true;
    } catch (e) {
      console.error('Erro ao salvar cliente no IndexedDB:', e);
    }
  }
  if (!salvo) {
    let clientes = [];
    try { clientes = JSON.parse(localStorage.getItem('customers')||'[]'); } catch { clientes = []; }
    clientes.push(cliente);
    localStorage.setItem('customers', JSON.stringify(clientes));
  }
}

export async function listarClientes() {
  if (window.idb && window.openDB) {
    if (!window.db) window.db = await window.openDB();
    if (!window.idb) window.idb = idb;
    return await window.idb.all('customers');
  } else {
    try { return JSON.parse(localStorage.getItem('customers')||'[]'); } catch { return []; }
  }
}
