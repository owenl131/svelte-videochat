import App from './App.svelte';

jQuery(document).ready(() => {
	var elem = document.querySelector('#videochat-area');
	console.log(elem);
	var app = new App({
		target: elem
	});
});

// var app = new App({
// 	target: document.body
// });

// export default app;