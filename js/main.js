// Magic word designating the primary node
SENDER_PRIMARY = 'primary';
SENDER_AUX = 'aux';
performance.now = performance.now || performance.webkitNow; // hack added by SD!

var media = {};
media.fake = media.audio = true;

var sendChannel, receiveChannel;
started = false;
initiator = false;
// cnxn defined in createConnection

startButton.disabled = false;
sendButton.disabled = true;
closeButton.disabled = true;

// SOCKET //////////
var socket = new WebSocket('ws://localhost:1337/');

socket.onmessage = function processMessage(message) {
    var msg = JSON.parse(message.data);

    // Auxiliary node connection init/reinit
    if (msg.type === 'offer' && msg.sender === SENDER_PRIMARY) {
        // Close existing connections if primary node is calling
        if (started) {
            closeConnections();
        }

        createConnection();

        cnxn.setRemoteDescription(new RTCSessionDescription(msg));
        console.log("Sending session answer.");
        cnxn.createAnswer(setLocalAndSendMessage);

    } else if (msg.type == 'answer' && started) {
        console.log("Received answer from peer");
        cnxn.setRemoteDescription(new RTCSessionDescription(msg));

    } else if (msg.type === 'candidate' && started) {
        console.log("Adding new ICE candidate");
        var candidate = new RTCIceCandidate({
            sdpMLineIndex:msg.label, 
            candidate:msg.candidate
        });
        cnxn.addIceCandidate(candidate);

    } else if (msg.type === 'bye' && started) {
        console.log('BYE');
        closeConnections();
    }
}

// RTC
function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}

function createConnection() {
    started=true;
    var servers = null;
    window.cnxn = new webkitRTCPeerConnection(
        servers,
        {optional: [{RtpDataChannels: true}]}
    );

    trace('Created local peer connection object cnxn');

    try {
        // Reliable Data Channels not yet supported in Chrome
        // Data Channel api supported from Chrome M25.
        // You need to start chrome with  --enable-data-channels flag.
        if(initiator) {
            sendChannel = cnxn.createDataChannel("channel-"+(Math.random()*1000).toFixed(0),
                {reliable: false});
                sendChannel.onopen = onSendChannelStateChange;
                sendChannel.onclose = onSendChannelStateChange;
                trace('Created send data channel');
        }
    } catch (e) {
        alert('Failed to create data channel. ' +
              'You need Chrome M25 or later with --enable-data-channels flag');
        trace('Create Data channel failed with exception: ' + e.message);
    }
    cnxn.onicecandidate = onIceCandidate;
    cnxn.ondatachannel = receiveChannelCallback;

    cnxn.onicechange = function(e){
        console.log('ICE state change:', e);
    };

    cnxn.onstatechange = function(e){
        console.log('Connection state change:', e);
    };

  /*
  //window.pc2 = new webkitRTCPeerConnection(servers, {optional: [{RtpDataChannels: true}]});
  trace('Created remote peer connection object pc2');

  pc2.onicecandidate = iceCallback2;
  */

  
  if(initiator){
      cnxn.createOffer(setLocalAndSendMessage);
  }
  startButton.disabled = true;
  closeButton.disabled = false;
}

function setLocalAndSendMessage(sessionDescription) {
    cnxn.setLocalDescription(sessionDescription);
    sessionDescription.sender = (initiator) ? SENDER_PRIMARY : SENDER_AUX;
    sendMessage(sessionDescription);
}

function sendMessage(message) {
    var msgString = JSON.stringify(message);
    console.log('MSG TO SERVER: ' + msgString);
    socket.send(msgString);
}

// DATA CHANNELS //////////////
function sendData() {
  var data = document.getElementById("dataChannelSend").value;
  sendChannel.send(data);
  trace('Sent Data: ' + data);
}

function closeConnections() {
  trace('Closing data Channels');
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  cnxn.close();
  //pc2.close();
  cnxn = null;
  //pc2 = null;
  trace('Closed peer connections');
  startButton.disabled = false;
  sendButton.disabled = true;
  closeButton.disabled = true;
  dataChannelSend.value = "";
  dataChannelReceive.value = "";
  dataChannelSend.disabled = true;
  dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
  started = false;
}


function onIceCandidate(event) {
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    } else {
        console.log("End of candidates.");
    }
}

function receiveChannelCallback(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveMessageCallback(event) {
  trace('Received Message');
  document.getElementById("dataChannelReceive").value = event.data;
}

function onSendChannelStateChange() {
    var readyState = sendChannel.readyState;
    trace('Send channel state change: ' + readyState);
    if (readyState == "open") {
        dataChannelSend.disabled = false;
        dataChannelSend.focus();
        dataChannelSend.placeholder = "";
        sendButton.disabled = false;
        closeButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
        closeButton.disabled = true;
    }
}

function onReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
}
