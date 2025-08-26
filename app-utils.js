// Funções utilitárias e de inicialização do app
// Modularize aqui as funções de clientes, produtos, vendas, etc.

// Exemplo: Função para inicializar IndexedDB
export async function initDB() {
  if (!window.openDB) throw new Error('openDB não está disponível');
  if (!window.db) window.db = await window.openDB();
  if (!window.idb) window.idb = idb;
}

// Outras funções podem ser exportadas aqui para uso em outros scripts
