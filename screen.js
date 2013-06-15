function screen(emulator) {
	this.canvas = document.getElementById('screen');
	this.screen = this.canvas.getContext("2d");

	// initialize
	this.screen.fillStyle = "#000000";
    this.screen.fillRect(0, 0, this.canvas.width, this.canvas.height);
}