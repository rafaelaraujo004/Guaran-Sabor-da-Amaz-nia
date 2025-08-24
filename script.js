// Conteúdo original do script.js movido para a pasta public
/******************** Utilidades ********************/
/**
 * Seleciona o primeiro elemento que bate com o seletor.
 * @param {string} sel 
 * @param {HTMLElement} root 
 * @returns {HTMLElement|null}
 */
const $$ = (sel, root=document) => root.querySelector(sel);
/**
 * Seleciona todos os elementos que batem com o seletor.
 * @param {string} sel 
 * @param {HTMLElement} root 
 * @returns {HTMLElement[]}
 */
const $$$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const BRL = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}`;

// ...restante do código JS original...
