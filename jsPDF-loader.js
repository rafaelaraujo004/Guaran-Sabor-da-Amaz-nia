// Adiciona jsPDF via CDN para geração de PDF
(function(){
	if (!window.jspdfLoaded) {
		var script = document.createElement('script');
		script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
		script.onload = function() { window.jspdfLoaded = true; };
		document.head.appendChild(script);
	}
})();
