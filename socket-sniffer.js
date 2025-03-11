// Variables to store OHLC data
let openPrice = null;
let highPrice = null;
let lowPrice = null;
let closePrice = null;

// Function to send OHLC data to the backend
function sendToServer(ohlcData) {
    fetch("http://localhost:3000/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ohlcData),
    })
    .then(response => response.json())
    .then(data => console.log("✅ Data sent to server:", data))
    .catch(error => console.error("❌ Error sending data:", error));
}

// Logging interval (every 5 seconds)
setInterval(() => {
    if (openPrice !== null && closePrice !== null) {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const ohlcData = { open: openPrice, high: highPrice, low: lowPrice, close: closePrice, timestamp };
        console.log("📡 Sending Data:", ohlcData);
        sendToServer(ohlcData);

        // Reset OHLC values for the next interval
        openPrice = null;
        highPrice = null;
        lowPrice = null;
        closePrice = null;
    }
}, 5000);

// WebSocket handling to extract live price updates
function logWebSocketTraffic(obj) {
    try {
        var data = JSON.parse(obj);

        if (Array.isArray(data) && Array.isArray(data[0]) && data.length === 1) {
            const price = parseFloat(data[0][2]); // Extract live price value

            // Set OPEN price only once at the start of a new interval
            if (openPrice === null) {
                openPrice = price;
                highPrice = price;
                lowPrice = price;
            }

            // Update HIGH and LOW dynamically
            if (price > highPrice) highPrice = price;
            if (price < lowPrice) lowPrice = price;

            // Always update CLOSE price with the latest price
            closePrice = price;
        }
    } catch (error) {
        console.error('Error parsing WebSocket data:', error);
    }
}

// WebSocket interception to capture price updates
function decorateWebSocketConstructor() {
    var OrigWebSocket = window.WebSocket;
    var wsAddListener = OrigWebSocket.prototype.addEventListener;
    wsAddListener = wsAddListener.call.bind(wsAddListener);
    
    window.WebSocket = function WebSocket(url, protocols) {
        var ws = new OrigWebSocket(url, protocols);

        wsAddListener(ws, 'message', function (event) {
            if (typeof event.data === 'object') {
                var dec = new TextDecoder('UTF-8');
                var str = dec.decode(event.data);
                logWebSocketTraffic(str);
            }
        });

        return ws;
    }.bind();

    window.WebSocket.prototype = OrigWebSocket.prototype;
    window.WebSocket.prototype.constructor = window.WebSocket;
}

// Initialize WebSocket interception
decorateWebSocketConstructor();
