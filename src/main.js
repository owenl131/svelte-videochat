import App from './App.svelte';

var debugMode = true;

if (!debugMode) {
	jQuery(document).ready(() => {
		var elem = document.querySelector('#videochat-area');
		console.log(elem);
		var app = new App({
			target: elem,
			debugMode: false
		});
	});
}
else {
	var app = new App({
		target: document.body,
		debugMode: true
	});
}

export default app;
