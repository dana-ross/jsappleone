module.exports = {
	// configuration
	context: __dirname + "/app/src",
	entry: "./start.js",
	output: {
		path: __dirname + "/app/dist",
		filename: "bundle.js"
	},
	target: "web",
	watch: true
};
