define({
    /* 
     * WebSockets are used to pass control and WebRTC messages
     */
    // TODO: sockets are used by both RTC and Peer modules. Consolidate
    initSocket: function initSocket() {
        this.socket = new WebSocket('ws://'+window.location.hostname+':1337/');

        return this.socket;
    },

});
