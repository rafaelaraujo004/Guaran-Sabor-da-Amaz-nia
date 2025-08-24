
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

// Sanear acentos para maior compatibilidade com ESC/POS simples
const mapLatin = Object.freeze({
	'Á':'A','Â':'A','Ã':'A','À':'A','É':'E','Ê':'E','Í':'I','Ó':'O','Ô':'O','Õ':'O','Ú':'U','Ç':'C',
	'á':'a','â':'a','ã':'a','à':'a','é':'e','ê':'e','í':'i','ó':'o','ô':'o','õ':'o','ú':'u','ç':'c'
});
/**
 * Remove acentos para compatibilidade com impressoras simples.
 * @param {string} s
 * @returns {string}
 */
const sanitize = s => s.replace(/[ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç]/g, ch => mapLatin[ch] || ch);

/******************** IndexedDB minimalista ********************/
const DB_NAME = 'guaranaPOS';
const DB_VER = 1;
let db;
/**
 * Abre o banco IndexedDB e inicializa stores se necessário.
 * @returns {Promise<IDBDatabase>}
 */
function openDB(){
	return new Promise((resolve, reject)=>{
		const req = indexedDB.open(DB_NAME, DB_VER);
		req.onupgradeneeded = e => {
			const d = e.target.result;
			if (!d.objectStoreNames.contains('products')) d.createObjectStore('products', {keyPath:'id'});
			if (!d.objectStoreNames.contains('sales')) d.createObjectStore('sales', {keyPath:'id'});
			if (!d.objectStoreNames.contains('customers')) d.createObjectStore('customers', {keyPath:'id'});
			if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', {keyPath:'key'});
		};
		req.onsuccess = () => { db = req.result; resolve(db); };
		req.onerror = () => reject(req.error);
	});
}
const idb = {
	async get(store, key){
		if (!db) await openDB();
		return new Promise((res,rej)=>{
			const tx=db.transaction(store,'readonly').objectStore(store).get(key);
			tx.onsuccess=()=>res(tx.result);
			tx.onerror=()=>rej(tx.error);
		});
	},
	async set(store, value){
		if (!db) await openDB();
		return new Promise((res,rej)=>{
			const tx=db.transaction(store,'readwrite').objectStore(store).put(value);
			tx.onsuccess=()=>res(value);
			tx.onerror=()=>rej(tx.error);
		});
	},
	async del(store, key){
		if (!db) await openDB();
		return new Promise((res,rej)=>{
			const tx=db.transaction(store,'readwrite').objectStore(store).delete(key);
			tx.onsuccess=()=>res();
			tx.onerror=()=>rej(tx.error);
		});
	},
	async all(store){
		if (!db) await openDB();
		return new Promise((res,rej)=>{
			const out=[];
			const tx=db.transaction(store,'readonly').objectStore(store).openCursor();
			tx.onsuccess=()=>{
				const c=tx.result;
				if(c){ out.push(c.value); c.continue(); } else res(out); };
			tx.onerror=()=>rej(tx.error);
		});
	}
};

/******************** Estado ********************/
const state = {
	cart: [],
	lastSale: null,
	printer: { device:null, server:null, characteristic:null },
	settings: { bName:'Guaraná da Amazônia', bPhone:'', bAddr:'', bMsg:'Obrigado pela preferência!', taxRate:0, currency:'BRL' }
};

/******************** Navegação de seções ********************/
// Inicialização de navegação e preview de imagem
function setupNavigationAndImagePreview() {
	// Preview da imagem ao selecionar arquivo
	const fileInput = $$('#pImage');
	const imgPreview = $$('#pImagePreview');
	if (fileInput && imgPreview) {
		fileInput.addEventListener('change', function() {
			if (this.files && this.files[0]) {
				const reader = new FileReader();
				reader.onload = e => {
					imgPreview.src = e.target.result;
					imgPreview.style.display = 'block';
				};
				reader.readAsDataURL(this.files[0]);
			} else {
				imgPreview.src = '';
				imgPreview.style.display = 'none';
			}
		});
	}
	// Navegação
	$$$('nav button').forEach(btn => btn.addEventListener('click', () => {
		$$$('nav button').forEach(b => b.removeAttribute('aria-current'));
		btn.setAttribute('aria-current', 'page');
		$$$('main > section').forEach(s => s.hidden = true);
		const id = btn.dataset.route;
		const section = $$('#' + id);
		if (section) section.hidden = false;
	}));
}
window.addEventListener('DOMContentLoaded', setupNavigationAndImagePreview);

/******************** Carregar/Salvar configurações ********************/
async function loadSettings(){
	const items = await idb.all('settings');
	for(const it of items){ state.settings[it.key] = it.value; }
	setInputValue('bName', state.settings.bName || '');
	setInputValue('bPhone', state.settings.bPhone || '');
	setInputValue('bAddr', state.settings.bAddr || '');
	setInputValue('bMsg', state.settings.bMsg || '');
	setInputValue('taxRate', state.settings.taxRate || 0);
	setInputValue('currency', state.settings.currency || 'BRL');
}

// Utilitário para setar valor em input se existir
function setInputValue(id, value) {
	const el = $$('#' + id);
	if (el) el.value = value;
}
async function saveSetting(key, value){
	state.settings[key]=value; await idb.set('settings',{key,value});
}
window.addEventListener('DOMContentLoaded', () => {
	$$$('#config input, #config select').forEach(el=>{
		el.addEventListener('change',()=> saveSetting(el.id.replace(/^b|taxRate|currency/g,'')?el.id:el.id, el.value));
	});
});

/******************** Produtos ********************/
function productRow(p){
	const tr = document.createElement('tr');
	tr.innerHTML = `<td>${p.sku||''}</td><td>${p.name}</td><td class="right">${BRL.format(+p.price||0)}</td><td class="right">${BRL.format(+p.cost||0)}</td><td class="right">${p.stock||0}</td><td class="right"><button class="btn secondary btn-edit">Editar</button> <button class="btn danger btn-del">Excluir</button></td>`;
	tr.querySelector('.btn-edit').onclick = ()=>fillProductForm(p);
	tr.querySelector('.btn-del').onclick = async()=>{ if(confirm('Excluir o produto?')){ await idb.del('products', p.id); renderProducts(); renderCatalog(); } };
	return tr;
}
function fillProductForm(p){
	$$('#pName').value=p.name; $$('#pSku').value=p.sku||''; $$('#pPrice').value=p.price||0; $$('#pCost').value=p.cost||0; $$('#pStock').value=p.stock||0; $$('#pCategory').value=p.category||'';
	$$('#btnSaveProduct').dataset.editId = p.id;
}
async function renderProducts(filter=''){
	const tbody = $$('#productsBody'); tbody.innerHTML='';
	const all = await idb.all('products');
	const list = all.filter(p => (p.name+p.sku).toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
	for(const p of list) tbody.appendChild(productRow(p));
}
window.addEventListener('DOMContentLoaded', () => {
	// Filtro de produtos
	const filterInput = $$('#filterProducts');
	if (filterInput)
		filterInput.addEventListener('input', e => renderProducts(e.target.value));

	// Novo produto
	const btnNew = $$('#btnNewProduct');
	if (btnNew)
		btnNew.onclick = clearProductForm;

	// Salvar produto
	const btnSave = $$('#btnSaveProduct');
	if (btnSave)
		btnSave.onclick = saveProduct;
});

// Limpa o formulário de produto
function clearProductForm() {
	$$$('#produtos input').forEach(i=>i.value='');
	if ($$('#btnSaveProduct')) delete $$('#btnSaveProduct').dataset.editId;
	if ($$('#pImage')) $$('#pImage').value = '';
	if ($$('#pImagePreview')) {
		$$('#pImagePreview').src = '';
		$$('#pImagePreview').style.display = 'none';
	}
}

// Salva o produto no banco e atualiza UI
async function saveProduct() {
	if (!db) await openDB();
	let imageData = null;
	const fileInput = $$('#pImage');
	if (fileInput && fileInput.files && fileInput.files[0]) {
		const file = fileInput.files[0];
		imageData = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = e => resolve(e.target.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}
	const id = $$('#btnSaveProduct').dataset.editId || uid('prod');
	const p = {
		id,
		name: $$('#pName').value.trim(),
		sku: $$('#pSku').value.trim(),
		price: +$$('#pPrice').value || 0,
		cost: +$$('#pCost').value || 0,
		stock: +$$('#pStock').value || 0,
		category: $$('#pCategory').value.trim(),
		image: imageData || ($$('#btnSaveProduct').dataset.editId ? (await idb.get('products', id))?.image : null)
	};
	if(!p.name) return alert('Informe o nome');
	await idb.set('products', p);
	if ($$('#btnSaveProduct')) delete $$('#btnSaveProduct').dataset.editId;
	clearProductForm();
	renderProducts();
	renderCatalog();
			alert('Produto salvo.');
		}

// Import/Export JSON
window.addEventListener('DOMContentLoaded', () => {
	$$('#btnExport').onclick = async ()=>{
		const dump = {
			products: await idb.all('products'),
			customers: await idb.all('customers'),
			sales: await idb.all('sales'),
			settings: await idb.all('settings')
		};
		const blob = new Blob([JSON.stringify(dump)], {type:'application/json'});
		const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='guarana-pos-backup.json'; a.click();
	};
	$$('#btnImport').onclick = ()=>{
		const i=document.createElement('input'); i.type='file'; i.accept='.json,application/json';
		i.onchange=async()=>{
			const [f]=i.files; if(!f) return; const j=JSON.parse(await f.text());
			for(const p of (j.products||[])) await idb.set('products', p);
			for(const c of (j.customers||[])) await idb.set('customers', c);
			for(const s of (j.sales||[])) await idb.set('sales', s);
			for(const s of (j.settings||[])) await idb.set('settings', s);
			await renderProducts(); await renderCatalog(); await renderCustomers(); alert('Importado.');
		};
		i.click();
	};
});

/******************** Catálogo & Carrinho ********************/
async function renderCatalog(q=''){
		const box = $$('#listaProdutos'); box.innerHTML='';
		const all = await idb.all('products');
		const list = all.filter(p => (p.name+p.sku).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
		if(list.length===0) box.innerHTML='<p style="color:var(--muted)">Cadastre produtos em “Produtos & Estoque”.</p>';
		const tpl = document.getElementById('tplProductCard');
		for(const p of list){
			let card;
			if (tpl && tpl.content) {
				card = tpl.content.cloneNode(true).children[0];
				const img = card.querySelector('.product-img');
				if (img) img.src = p.image || '';
				const name = card.querySelector('.product-name');
				if (name) name.textContent = p.name;
				const meta = card.querySelector('.product-meta');
				if (meta) meta.textContent = `SKU ${p.sku||'-'} · Estoque ${p.stock||0}`;
				const price = card.querySelector('.product-price');
				if (price) price.textContent = BRL.format(+p.price||0);
				const btn = card.querySelector('button');
				if (btn) {
					btn.disabled = !(p.stock>0);
					btn.onclick = ()=>addToCart(p.id,1);
				}
			} else {
				card=document.createElement('div'); card.className='card'; card.innerHTML=
					`<div class="body">
						 <b>${p.name}</b>
						 <div style="color:var(--muted);font-size:13px">SKU ${p.sku||'-'} · Estoque ${p.stock||0}</div>
						 <div style="margin:8px 0;font-weight:700">${BRL.format(+p.price||0)}</div>
						 <button class="btn" ${p.stock>0?'':'disabled'}>Adicionar</button>
					 </div>`;
				card.querySelector('button').onclick=()=>addToCart(p.id,1);
			}
			box.appendChild(card);
		}
}
window.addEventListener('DOMContentLoaded', () => {
	$$('#search').addEventListener('input', e=>renderCatalog(e.target.value));
});

async function addToCart(productId, qty){
	const p = await idb.get('products', productId); if(!p) return;
	const line = state.cart.find(l=>l.id===productId) || (state.cart.push({id:p.id,name:p.name,price:+p.price,cost:+p.cost,qty:0}), state.cart[state.cart.length-1]);
	if(p.stock < (line.qty + qty)) { alert('Estoque insuficiente'); return; }
	line.qty += qty; renderCart();
}
function renderCart(){
	const tb = $$('#cartBody'); tb.innerHTML='';
	for(const l of state.cart){
		const tr=document.createElement('tr');
		tr.innerHTML=`<td>${l.name}</td>
			<td class='right'><input type='number' min='1' value='${l.qty}' style='width:70px;text-align:right'></td>
			<td class='right'>${BRL.format(l.price)}</td>
			<td class='right'>${BRL.format(l.price*l.qty)}</td>
			<td class='right'><button class='btn danger'>×</button></td>`;
		tr.querySelector('input').onchange=(e)=>{ l.qty = Math.max(1, +e.target.value||1); updateTotals(); };
		tr.querySelector('button').onclick=()=>{ state.cart = state.cart.filter(x=>x!==l); renderCart(); };
		tb.appendChild(tr);
	}
	updateTotals();
}
window.addEventListener('DOMContentLoaded', () => {
	$$('#btnClearCart')?.addEventListener('click', ()=>{state.cart=[]; renderCart();});
});

function calcTotals(){
	const subtotal = state.cart.reduce((s,l)=>s + l.price*l.qty, 0);
	const discount = +($$('#discount')?.value || 0);
	const taxRate = +($$('#taxRate')?.value || 0);
	const base = Math.max(0, subtotal - discount);
	const taxes = base * (taxRate/100);
	const total = base + taxes;
	// lucro = soma((preco - custo)*qtd) - proporção do desconto
	const grossProfit = state.cart.reduce((s,l)=> s + (l.price - l.cost)*l.qty, 0);
	const discRatio = subtotal ? (discount/subtotal) : 0;
	const profit = grossProfit * (1 - discRatio);
	return {subtotal, discount, taxes, total, profit};
}
function updateTotals(){
	const {subtotal,discount,taxes,total} = calcTotals();
	$$('#subtotal').textContent = BRL.format(subtotal);
	$$('#taxes') && ($$('#taxes').textContent = BRL.format(taxes));
	$$('#grandTotal').textContent = BRL.format(total);
	$$('#btnFinalizar').disabled = state.cart.length===0;
}
window.addEventListener('DOMContentLoaded', () => {
	$$('#discount')?.addEventListener('input', updateTotals);
	$$('#btnFinalizar')?.addEventListener('click', async ()=>{
		const totals = calcTotals();
		if(state.cart.length===0) return;
		// baixa de estoque
		for(const l of state.cart){ const p = await idb.get('products', l.id); if(p){ p.stock = (p.stock||0) - l.qty; await idb.set('products', p); } }
		await renderProducts(); await renderCatalog($$('#search')?.value||'');
		const sale = { id:uid('sale'), at:Date.now(), items:state.cart.map(l=>({...l})), ...totals, payment:$$('#paymentMethod')?.value, customerId:$$('#saleCustomer')?.value||null };
		await idb.set('sales', sale); state.lastSale = sale; state.cart=[]; renderCart();
		alert('Venda registrada!');
		$$('#btnPrint') && ($$('#btnPrint').disabled=false);
	});
});

/******************** Clientes ********************/
function customerRow(c){
	const tr=document.createElement('tr');
	tr.innerHTML=`<td>${c.name}</td><td>${c.phone||''}</td><td>${c.email||''}</td><td>${c.doc||''}</td><td class='right'><button class='btn danger'>Excluir</button></td>`;
	tr.querySelector('button').onclick=async()=>{ if(confirm('Excluir cliente?')){ await idb.del('customers', c.id); renderCustomers(); fillCustomersSelect(); } };
	return tr;
}
async function renderCustomers(){ const tb=$$('#customersBody'); tb.innerHTML=''; for(const c of await idb.all('customers')) tb.appendChild(customerRow(c)); }
async function fillCustomersSelect(){ const sel=$$('#saleCustomer'); if(!sel) return; sel.innerHTML='<option value="">—</option>'; for(const c of await idb.all('customers')){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o);} }
window.addEventListener('DOMContentLoaded', () => {
	$$('#btnSaveCustomer')?.addEventListener('click', async () => {
		try {
			if (!db) await openDB();
			const c = {
				id: uid('cust'),
				name: $$('#cName').value.trim(),
				phone: $$('#cPhone').value.trim(),
				email: $$('#cEmail').value.trim(),
				doc: $$('#cDoc').value.trim()
			};
			if (!c.name) return alert('Informe o nome');
			await idb.set('customers', c);
			$$$('#clientes input').forEach(i => i.value = '');
			await renderCustomers();
			await fillCustomersSelect();
			alert('Cliente salvo com sucesso!');
		} catch (e) {
			alert('Erro ao salvar cliente: ' + (e.message || e));
		}
	});
});

/******************** Relatórios ********************/
function dayKey(ts){ const d=new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function inRange(ts, a, b){ return (!a || ts>=a) && (!b || ts<=b); }
async function runReport(){
	const from = $$('#fromDate')?.value ? new Date($$('#fromDate').value+'T00:00').getTime() : null;
	const to = $$('#toDate')?.value ? new Date($$('#toDate').value+'T23:59:59').getTime() : null;
	const sales = (await idb.all('sales')).filter(s=>inRange(s.at, from, to)).sort((a,b)=>a.at-b.at);
	const revenue = sales.reduce((s,x)=>s+x.total,0);
	const profit = sales.reduce((s,x)=>s+x.profit,0);
	const avg = sales.length? revenue/sales.length : 0;
	$$('#kpiRevenue').textContent = BRL.format(revenue);
	$$('#kpiProfit').textContent = BRL.format(profit);
	$$('#kpiSalesCount').textContent = `${sales.length} vendas`;
	$$('#kpiAvg').textContent = BRL.format(avg);
	$$('#kpiMargin').textContent = `Margem ${(revenue? (profit/revenue*100):0).toFixed(1)}%`;
	$$('#kpiPeriod').textContent = from||to ? 'Período filtrado' : 'Tudo';

	// Série diária
	const days = {};
	for(const s of sales){ const k=dayKey(s.at); days[k]=(days[k]||0)+s.total; }
	const labels = Object.keys(days).sort().map(ts=>{ const d=new Date(+ts); return `${('0'+d.getDate()).slice(-2)}/${('0'+(d.getMonth()+1)).slice(-2)}`;});
	const values = Object.keys(days).sort().map(ts=>days[ts]);
	drawChart(labels, values);

	// Top produtos
	const top={};
	for(const s of sales){ for(const it of s.items){ top[it.id] = top[it.id] || {name:it.name, qty:0, revenue:0, profit:0}; top[it.id].qty += it.qty; top[it.id].revenue += it.qty*it.price; top[it.id].profit += it.qty*(it.price-it.cost); }}
	const rows = Object.values(top).sort((a,b)=>b.revenue-a.revenue).slice(0,20);
	const tb = $$('#reportTop'); tb.innerHTML='';
	for(const r of rows){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.name}</td><td class='right'>${r.qty}</td><td class='right'>${BRL.format(r.revenue)}</td><td class='right'>${BRL.format(r.profit)}</td>`; tb.appendChild(tr); }
}
let chart;
function drawChart(labels, data){
	const ctx = $$('#chart').getContext('2d');
	if(chart) chart.destroy();
	chart = new Chart(ctx, { type:'line', data:{ labels, datasets:[{ label:'Receita diária', data, tension:.25, borderWidth:2, fill:false }] }, options:{ plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } } });
}
window.addEventListener('DOMContentLoaded', () => {
	$$('#btnRunReport')?.addEventListener('click', runReport);
});

/******************** Barcode (quando suportado) ********************/
window.addEventListener('DOMContentLoaded', () => {
	$$('#btnScan')?.addEventListener('click', async ()=>{
		if(!('BarcodeDetector' in window)){ alert('Leitor não suportado neste navegador.'); return; }
		const formats = await BarcodeDetector.getSupportedFormats();
		const detector = new BarcodeDetector({formats});
		const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
		const video = document.createElement('video'); video.srcObject=stream; await video.play();
		const modal = document.createElement('div'); modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:99';
		const frame = document.createElement('div'); frame.style.cssText='background:#000;border:6px solid #fff;border-radius:16px;overflow:hidden;max-width:90vw;'; frame.appendChild(video); modal.appendChild(frame); document.body.appendChild(modal);
		let running=true;
		modal.onclick=()=>{ running=false; stream.getTracks().forEach(t=>t.stop()); modal.remove(); };
		(async function loop(){ while(running){ const res = await detector.detect(video); if(res[0]){ const code=res[0].rawValue; const all=await idb.all('products'); const p=all.find(x=>x.sku===code); if(p){ addToCart(p.id,1); } else alert('SKU não encontrado: '+code); running=false; stream.getTracks().forEach(t=>t.stop()); modal.remove(); break; } await new Promise(r=>setTimeout(r,200)); } })();
	});
});

/******************** Impressão ************************/
async function connectPrinter(){
	if(!navigator.bluetooth){ alert('Web Bluetooth não suportado neste dispositivo. Use o modo de impressão do sistema.'); return; }
	try{
		// Solicita todos os dispositivos Bluetooth disponíveis
		const device = await navigator.bluetooth.requestDevice({
			acceptAllDevices: true,
			optionalServices: [0xFFE0, 0xFF02, 0x18F0, '6e400001-b5a3-f393-e0a9-e50e24dcca9e']
		});

		// Exibe informações do dispositivo encontrado
		let info = `Dispositivo selecionado:\nNome: ${device.name || '(sem nome)'}\nID: ${device.id}`;
		if (device.uuids && device.uuids.length) {
			info += `\nUUIDs: ${device.uuids.join(', ')}`;
		}
		alert(info);

		const server = await device.gatt.connect();
		// procurar característica gravável
		const services = await server.getPrimaryServices();
		let writable = null;
		for (const s of services) {
			const chars = await s.getCharacteristics();
			for (const c of chars) {
				if (c.properties.writeWithoutResponse || c.properties.write) {
					writable = c;
					break;
				}
			}
			if (writable) break;
		}
		if (!writable) throw new Error('Não foi encontrada característica de escrita na impressora.');
		state.printer = { device, server, characteristic: writable }; updatePrinterStatus(true);
		alert('Impressora conectada!');
	} catch (err) {
		console.error(err);
		alert('Falha ao conectar: ' + err.message);
		updatePrinterStatus(false);
	}
}
function updatePrinterStatus(connected){
	const el=$$('#printerStatus');
	if(connected){ el.textContent='🖨️ Impressora: conectada'; el.classList.remove('warn','bad'); el.classList.add('ok'); }
	else { el.textContent='🖨️ Impressora: desconectada'; el.classList.add('warn'); el.classList.remove('ok'); }
}
async function printLastReceipt(){ if(!state.lastSale) return alert('Nenhuma venda para imprimir.'); await printReceipt(state.lastSale); }

function enc(str){ // encode em ISO-8859-1 approx
	str = sanitize(str);
	const arr = new Uint8Array(str.length);
	for(let i=0;i<str.length;i++) arr[i]=str.charCodeAt(i)&0xFF; // best-effort
	return arr;
}
function cmd(...nums){ return new Uint8Array(nums); }
function joinBytes(chunks){ let len=chunks.reduce((s,a)=>s+a.length,0); const out=new Uint8Array(len); let o=0; for(const a of chunks){ out.set(a,o); o+=a.length; } return out; }
function makeReceiptBytes(sale){
	const ESC=27, GS=29;
	const header = joinBytes([
		cmd(ESC,64), // init
		cmd(ESC,33,1), // negrito
		cmd(ESC,97,1), enc((state.settings.bName||'Guarana da Amazonia')+'\n'),
		cmd(ESC,33,0), enc((state.settings.bAddr||'')+'\n'), enc((state.settings.bPhone?('Tel: '+state.settings.bPhone):'')+'\n'),
		cmd(ESC,97,0), enc('--------------------------------\n')
	]);
	const bodyChunks=[];
	for(const it of sale.items){
		const line1 = `${it.name.slice(0,30)}\n`;
		const line2 = `${String(it.qty).padStart(2,' ')} x ${BRL.format(it.price).padStart(10,' ')}  ${BRL.format(it.qty*it.price).padStart(12,' ')}\n`;
		bodyChunks.push(enc(line1), enc(line2));
	}
	const totals = joinBytes([
		enc('--------------------------------\n'),
		cmd(ESC,69,1), enc('SUBTOTAL: '.padEnd(20,' ')+BRL.format(sale.subtotal)+'\n'), cmd(ESC,69,0),
		enc('DESCONTO: '.padEnd(20,' ')+BRL.format(sale.discount)+'\n'),
		enc('IMPOSTOS: '.padEnd(20,' ')+BRL.format(sale.taxes)+'\n'),
		cmd(ESC,69,1), enc('TOTAL:    '.padEnd(20,' ')+BRL.format(sale.total)+'\n'), cmd(ESC,69,0),
		enc('Pagamento: '+sale.payment+'\n'),
		enc((sale.customerId?'Cliente: '+sale.customerId:'')+'\n'),
		enc('--------------------------------\n')
	]);
	const footer = joinBytes([
		cmd(ESC,97,1), enc((state.settings.bMsg||'Obrigado! Volte sempre!')+'\n'),
		enc(new Date(sale.at).toLocaleString('pt-BR')+'\n'),
		cmd(ESC,97,0),
		cmd(10,10), // feed
		cmd(GS,86,66,0) // corte parcial
	]);
	return joinBytes([header, ...bodyChunks, totals, footer]);
}
async function writeBLE(characteristic, bytes){
	// dividir em blocos (BLE ~20 bytes)
	const MTU = 180; // Chrome BLE geralmente aceita entre 20 e 180, fazemos seguro por 128/180
	for(let i=0;i<bytes.length;i+=MTU){ const chunk = bytes.slice(i, i+MTU); await characteristic.writeValueWithoutResponse(chunk).catch(async()=>{ await characteristic.writeValue(chunk); }); await new Promise(r=>setTimeout(r,10)); }
}
async function printReceipt(sale){
	// 1) Tentar BLE ESC/POS
	if(state.printer.characteristic){
		try{ const data = makeReceiptBytes(sale); await writeBLE(state.printer.characteristic, data); return; } catch(e){ console.warn('BLE falhou:', e); }
	}
	// 2) Fallback: imprimir via sistema (window.print)
	makePrintableHTML(sale); window.print();
}
function makePrintableHTML(sale){
	const el = $$('#printArea');
	const lines = [
		`<div class='center'><h2>${state.settings.bName||'Guaraná da Amazônia'}</h2>${state.settings.bAddr||''}<br>${state.settings.bPhone||''}</div><hr>`
	];
	for(const it of sale.items){ lines.push(`<div>${it.name}</div><div class='line'><span>${it.qty} x ${BRL.format(it.price)}</span><b>${BRL.format(it.qty*it.price)}</b></div>`); }
	lines.push('<hr>');
	lines.push(`<div class='line'><span>SUBTOTAL</span><b>${BRL.format(sale.subtotal)}</b></div>`);
	lines.push(`<div class='line'><span>DESCONTO</span><b>${BRL.format(sale.discount)}</b></div>`);
	lines.push(`<div class='line'><span>IMPOSTOS</span><b>${BRL.format(sale.taxes)}</b></div>`);
	lines.push(`<div class='line'><span><b>TOTAL</b></span><b>${BRL.format(sale.total)}</b></div>`);
	lines.push(`<div>Pagamento: ${sale.payment}</div>`);
	if(sale.customerId) lines.push(`<div>Cliente: ${sale.customerId}</div>`);
	lines.push('<hr>');
	lines.push(`<div class='center'>${state.settings.bMsg||'Obrigado!'}</div>`);
	lines.push(`<div class='center'>${new Date(sale.at).toLocaleString('pt-BR')}</div>`);
	el.innerHTML = lines.join('');
}
window.addEventListener('DOMContentLoaded', () => {
	$$('#btnConnectPrinter')?.addEventListener('click', connectPrinter);
	$$('#btnConnectPrinter2')?.addEventListener('click', connectPrinter);
	$$('#btnPrint')?.addEventListener('click', printLastReceipt);
	$$('#btnTestPrint')?.addEventListener('click', ()=>{ if(!state.lastSale){ alert('Faça uma venda primeiro.'); } else printLastReceipt(); });
});

/******************** PWA: Manifest e Service Worker ************************/
async function createIcons(){
	// cria dois ícones simples via canvas
	const mk = (size)=>{ const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
		g.fillStyle='#0b6e4f'; g.fillRect(0,0,size,size); // folha
		g.fillStyle='#ff2e2e'; g.beginPath(); g.arc(size*0.42,size*0.42,size*0.28,0,Math.PI*2); g.fill(); // baga
		g.fillStyle='#073b3a'; g.beginPath(); g.arc(size*0.35,size*0.35,size*0.1,0,Math.PI*2); g.fill(); // semente
		return new Promise(res=> c.toBlob(b=>res(URL.createObjectURL(b)), 'image/png') ); };
	const i192 = await mk(192), i512 = await mk(512);
	return [{src:i192, sizes:'192x192', type:'image/png', purpose:'any maskable'}, {src:i512, sizes:'512x512', type:'image/png', purpose:'any maskable'}];
}
async function setupManifest(){
	const icons = await createIcons();
	const manifest = {
		name:'Guaraná da Amazônia POS', short_name:'Guaraná POS', start_url:'./', display:'standalone', background_color:'#073b3a', theme_color:'#0b6e4f', icons
	};
	const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
	const link=document.createElement('link'); link.rel='manifest'; link.href=URL.createObjectURL(blob); document.head.appendChild(link);
}
async function setupSW(){
	if(!('serviceWorker' in navigator)) return;
	const swCode = `
		const CACHE='guarana-pos-v1';
		const CORE=['./'];
		self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
		self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
		self.addEventListener('fetch', e=>{
			const url=new URL(e.request.url);
			if(url.origin===location.origin){
				e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res; }).catch(()=>caches.match('./'))));
			} else {
				// CDN (Chart.js) — network first, fallback cache
				e.respondWith(fetch(e.request).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res; }).catch(()=>caches.match(e.request)));
			}
		});
	`;
	const blob = new Blob([swCode], {type:'text/javascript'});
	const url = URL.createObjectURL(blob);
	try{ await navigator.serviceWorker.register(url); }catch(err){ console.warn('SW falhou', err); }
}
// Instalação (A2HS)
let deferredPrompt; const btnInstall = $$('#btnInstall');
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; btnInstall.hidden=false; });
btnInstall?.addEventListener('click', async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); const {outcome}=await deferredPrompt.userChoice; if(outcome==='accepted'){ btnInstall.hidden=true; } deferredPrompt=null; });

/******************** Inicialização ************************/
async function init(){
	try {
		await openDB();
	} catch (e) {
		alert('Erro ao abrir o banco de dados! O sistema não funcionará.\n' + (e.message || e));
		return;
	}
	try {
		await setupManifest();
		await setupSW();
		await loadSettings();
		await renderProducts();
		await renderCatalog();
		await renderCustomers();
		await fillCustomersSelect();
		// datas padrão relatório: mês atual
		const d=new Date(); const from=new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); const to=new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
		$$('#fromDate').value=from; $$('#toDate').value=to; runReport();
	} catch (e) {
		alert('Erro na inicialização do sistema:\n' + (e.message || e));
	}
}
window.addEventListener('error', function(e){
	alert('Erro de JavaScript:\n' + (e.error ? (e.error.stack || e.error) : e.message));
});
window.addEventListener('DOMContentLoaded', () => {
	init();
});
