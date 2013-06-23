function screen(emulator) {

	// initialize
	this.clear = function() {
		this.screen.fillStyle = "#000000";
	    this.screen.fillRect(0, 0, this.canvas.width, this.canvas.height);
	};

    /**
     * @param int x
     * @param int y
     */
    this.point = function(x,y) {
    	this.screen.fillStyle = '#9f9';
    	this.screen.fillRect(x, y, 1, 1);
    };

	this.canvas = document.getElementById('screen');
	this.screen = this.canvas.getContext("2d");
	this.clear();    
}